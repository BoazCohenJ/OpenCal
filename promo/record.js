// Records scripted app footage from the web build (npx expo start --web) as phone-size clips.
// Headless Edge at 390×844 @2x with touch; frames come from the CDP screencast and are re-timed
// to constant 30 fps. A touch indicator is injected so taps and swipes are visible.
//   node record.js [baseUrl] [clip ...]      e.g. node record.js http://localhost:8082 stamp dnd
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const puppeteer = require('puppeteer-core');
const { demoData } = require('./demo-data');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const FFMPEG = fs.existsSync('D:\\FFmpeg\\bin\\ffmpeg.exe') ? 'D:\\FFmpeg\\bin\\ffmpeg.exe' : 'ffmpeg';
const OUT = path.join(__dirname, 'out', 'footage');
const W = 390, H = 844, DPR = 2, FPS = 30;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const args = process.argv.slice(2);
const BASE = args[0]?.startsWith('http') ? args.shift() : 'http://localhost:8082';

// Touch indicator + helpers injected into the page.
const INJECT = () => {
  const dot = document.createElement('div');
  Object.assign(dot.style, {
    position: 'fixed', width: '44px', height: '44px', margin: '-22px 0 0 -22px', borderRadius: '50%',
    background: 'rgba(34,29,23,0.22)', border: '2px solid rgba(255,252,247,0.9)', boxShadow: '0 2px 10px rgba(0,0,0,.25)',
    pointerEvents: 'none', zIndex: 99999, opacity: 0, transform: 'scale(.6)', transition: 'opacity .18s, transform .18s',
  });
  document.body.appendChild(dot);
  // Browser focus rings aren't part of the phone app.
  const css = document.createElement('style');
  css.textContent = '*:focus, *:focus-visible { outline: none !important; }';
  document.head.appendChild(css);
  window.__touch = (x, y, phase) => {
    dot.style.left = `${x}px`;
    dot.style.top = `${y}px`;
    if (phase === 'start') Object.assign(dot.style, { opacity: 1, transform: 'scale(1)' });
    if (phase === 'end') Object.assign(dot.style, { opacity: 0, transform: 'scale(1.4)' });
  };
  // On web, lifting the finger after a long-press also "clicks" whatever is underneath (the day
  // view's empty slot, which clears the selection). Phones don't; swallow that one click.
  window.__swallowClick = () => {
    const types = ['touchend', 'pointerup', 'mouseup', 'click'];
    const h = (e) => {
      e.stopImmediatePropagation();
      e.preventDefault();
    };
    types.forEach((t) => window.addEventListener(t, h, { capture: true }));
    setTimeout(() => types.forEach((t) => window.removeEventListener(t, h, { capture: true })), 400);
  };
  // Mouse events the browser synthesizes after a touch can land on whatever a closing sheet
  // reveals. Swallow them (not the touch itself).
  window.__swallowCompat = () => {
    const types = ['mousedown', 'mouseup', 'click'];
    const h = (e) => {
      e.stopImmediatePropagation();
      e.preventDefault();
    };
    types.forEach((t) => window.addEventListener(t, h, { capture: true }));
    setTimeout(() => types.forEach((t) => window.removeEventListener(t, h, { capture: true })), 500);
  };
  /** Center of the deepest visible element whose text (or aria-label) matches. */
  window.__find = (text, { exact = true, index = -1 } = {}) => {
    const all = [...document.querySelectorAll('div, span, input, textarea, button, a')].filter((el) => {
      const r = el.getBoundingClientRect();
      if (!r.width || !r.height || r.bottom < 0 || r.top > innerHeight) return false;
      const t = (el.getAttribute('aria-label') || '').trim() === text || (exact ? el.textContent.trim() === text : el.textContent.includes(text));
      return t;
    });
    const deepest = all.filter((el) => !all.some((o) => o !== el && el.contains(o)));
    const el = deepest.at(index);
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2, rect: { x: r.left, y: r.top, w: r.width, h: r.height } };
  };
};

function makeApi(page) {
  // Absolute timestamps of taps/swipes/keys, turned into sound cues after recording.
  const log = [];
  const mark = (type, extra) => log.push({ type, at: Date.now() / 1000, ...extra });
  const touch = (x, y, phase) => page.evaluate((x, y, p) => window.__touch(x, y, p), x, y, phase);
  const find = async (text, opts) => {
    const p = await page.evaluate((t, o) => window.__find(t, o), text, opts || {});
    if (!p) throw new Error(`not found: ${text}`);
    return p;
  };
  const tapAt = async (x, y, hold = 110, { swallowCompat = false } = {}) => {
    mark('tap');
    await touch(x, y, 'start');
    await page.touchscreen.touchStart(x, y);
    await sleep(hold);
    if (swallowCompat) await page.evaluate(() => window.__swallowCompat());
    await page.touchscreen.touchEnd();
    await touch(x, y, 'end');
  };
  return {
    log,
    page,
    sleep,
    find,
    tapAt,
    tap: async (text, opts = {}) => {
      const { x, y } = await find(text, opts);
      await tapAt(x, y, 110, opts);
    },
    /** Logs where an element is, so the scene can circle it in tomato pen. */
    highlight: async (text, opts) => {
      const { rect } = await find(text, opts);
      mark('mark', { rect, label: text });
    },
    longPress: async (text, opts) => {
      const { x, y } = await find(text, opts);
      mark('tap');
      await touch(x + 120, y, 'start');
      await page.touchscreen.touchStart(x + 120, y);
      await sleep(650);
      await page.evaluate(() => window.__swallowClick());
      await page.touchscreen.touchEnd();
      await touch(x + 120, y, 'end');
    },
    /** Press on an element, hold briefly, then drag it by (dx, dy). */
    drag: async (text, dx, dy, ms = 700) => {
      const { x, y } = await find(text);
      mark('tap');
      await touch(x, y, 'start');
      await page.touchscreen.touchStart(x, y);
      await sleep(180);
      const steps = Math.round(ms / 16);
      for (let i = 1; i <= steps; i++) {
        const e = i / steps;
        const k = e < 0.5 ? 2 * e * e : 1 - Math.pow(-2 * e + 2, 2) / 2;
        await page.touchscreen.touchMove(x + dx * k, y + dy * k);
        await touch(x + dx * k, y + dy * k, 'move');
        await sleep(ms / steps);
      }
      await sleep(120);
      await page.touchscreen.touchEnd();
      await touch(x + dx, y + dy, 'end');
    },
    /** Scrolls the content under the finger by dy (negative = reveal content further down). */
    scroll: async (dy, ms = 380, x = 200, y = 520) => {
      const steps = Math.max(10, Math.round(ms / 16));
      await page.touchscreen.touchStart(x, y);
      for (let i = 1; i <= steps; i++) {
        await page.touchscreen.touchMove(x, y + (dy * i) / steps);
        await sleep(ms / steps);
      }
      await sleep(60);
      await page.touchscreen.touchEnd();
    },
    /** Scrolls (mouse wheel, so no touch state is left behind) until the element sits at about y. */
    scrollTo: async (text, y, opts) => {
      await page.mouse.move(200, 600);
      for (let i = 0; i < 12; i++) {
        const p = await page.evaluate((t, o) => window.__find(t, o), text, opts || {});
        const cur = p ? p.y : 2000;
        if (Math.abs(cur - y) < 20) return;
        await page.mouse.wheel({ deltaY: Math.max(-600, Math.min(600, cur - y)) });
        await sleep(450);
      }
    },
    swipe: async (x1, y1, x2, y2, ms = 320) => {
      const steps = Math.max(8, Math.round(ms / 16));
      mark('swipe');
      await touch(x1, y1, 'start');
      await page.touchscreen.touchStart(x1, y1);
      for (let i = 1; i <= steps; i++) {
        const e = i / steps;
        const k = 1 - Math.pow(1 - e, 2);
        const x = x1 + (x2 - x1) * k, y = y1 + (y2 - y1) * k;
        await page.touchscreen.touchMove(x, y);
        await touch(x, y, 'move');
        await sleep(ms / steps);
      }
      await page.touchscreen.touchEnd();
      await touch(x2, y2, 'end');
    },
    type: async (text, cps = 15) => {
      for (const ch of text) {
        mark('key');
        await page.keyboard.type(ch);
        await sleep(1000 / cps * (ch === ' ' ? 0.7 : 1));
      }
    },
    /** Hides the web-only "Not available here" notice (the phone app doesn't show it). */
    hideWebNotice: () =>
      page.evaluate(() => {
        const all = [...document.querySelectorAll('div')].filter((d) => d.textContent.startsWith('Not available here') && d.textContent.includes('Reminders work'));
        const card = all.filter((el) => !all.some((o) => o !== el && el.contains(o)))[0];
        let box = card;
        while (box && box.parentElement && box.parentElement.textContent === card.textContent) box = box.parentElement;
        if (box) box.style.display = 'none';
      }),
  };
}

// Each clip: optional setup (not recorded), then the recorded script.
const CLIPS = {
  views: {
    async run(a) {
      await a.sleep(600);
      await a.swipe(330, 470, 70, 470, 300);
      await a.sleep(900);
      await a.swipe(70, 470, 330, 470, 300);
      await a.sleep(800);
      await a.tap('Week');
      await a.sleep(1100);
      await a.tap('Day');
      await a.sleep(1100);
    },
  },
  quickadd: {
    async setup(a) {
      await a.tap('Week');
      await a.sleep(800);
    },
    async run(a) {
      await a.sleep(400);
      await a.tap('Quick add with natural language');
      await a.sleep(900);
      await a.type('Lunch with Sam tomorrow 1pm at Cafe Nero', 16);
      await a.highlight('Sat, Sep', { exact: false });
      await a.sleep(900);
      await a.tap('Review & confirm');
      await a.sleep(1000);
      await a.tap('Save');
      await a.sleep(1600);
    },
  },
  stamp: {
    async setup(a) {
      await a.tap('Day');
      await a.sleep(900);
    },
    async run(a, { stampY = 560 } = {}) {
      await a.sleep(500);
      await a.tapAt(220, stampY);
      await a.sleep(1000);
      await a.tap('Coffee');
      await a.sleep(350);
      await a.highlight('Undo');
      await a.sleep(1650);
    },
  },
  multiselect: {
    async setup(a) {
      await a.tap('Day');
      await a.sleep(900);
      await a.page.mouse.move(200, 600);
      await a.page.mouse.wheel({ deltaY: -3000 });
      await a.sleep(600);
      await a.scrollTo('Emails', 250);
      await a.sleep(500);
    },
    async run(a) {
      await a.sleep(400);
      await a.longPress('Design review');
      await a.sleep(450);
      await a.drag('Design review', 0, 112, 900);
      await a.sleep(600);
      await a.tap('+ 15 min');
      await a.sleep(500);
      await a.tap('Done');
      await a.sleep(700);
    },
  },
  pause: {
    async setup(a) {
      await a.tap('Schedule');
      await a.sleep(900);
    },
    async run(a) {
      await a.sleep(400);
      await a.tap('Yoga', { exact: false, index: 0 });
      await a.sleep(1000);
      await a.scroll(-420);
      await a.sleep(700);
      await a.tap('Add pause');
      await a.sleep(900);
      await a.tap('28', { index: -1 });
      await a.sleep(450);
      await a.tap('10', { index: -1 });
      await a.sleep(700);
      await a.tap('Add');
      await a.sleep(900);
      await a.highlight('Sep 28', { exact: false });
      await a.sleep(900);
    },
  },
  reminder: {
    theme: 'dark',
    async setup(a) {
      await a.tap('Schedule');
      await a.sleep(900);
    },
    async run(a) {
      await a.sleep(400);
      await a.tap('Design review');
      await a.sleep(1000);
      await a.scroll(-520);
      await a.sleep(700);
      await a.tap('Custom…', { index: -1 });
      await a.sleep(1000);
      await a.tap('20', { index: -1 });
      await a.sleep(400);
      await a.page.keyboard.down('Control');
      await a.page.keyboard.press('KeyA');
      await a.page.keyboard.up('Control');
      await a.type('7', 8);
      await a.sleep(700);
      await a.tap('Add reminder');
      await a.sleep(700);
      await a.highlight('7 minutes before');
      await a.sleep(800);
    },
  },
  colors: {
    async setup(a) {
      await a.tap('Schedule');
      await a.sleep(900);
    },
    async run(a) {
      await a.sleep(300);
      await a.tap('1:1 with Ana');
      await a.sleep(900);
      await a.scroll(-600, 420);
      await a.sleep(150);
      await a.scroll(-600, 420);
      await a.sleep(500);
      await a.tap('Poppy');
      await a.sleep(500);
      await a.tap('Emerald');
      await a.sleep(500);
      await a.tap('Violet');
      await a.sleep(600);
      await a.tap('Pick from color wheel');
      await a.sleep(1300);
    },
  },
  defaults: {
    theme: 'dark',
    async setup(a) {
      await a.tap('Settings');
      await a.sleep(800);
      await a.tap('Calendars');
      await a.sleep(900);
    },
    async run(a) {
      await a.sleep(300);
      await a.tap('Work');
      await a.sleep(1000);
      await a.scroll(-380, 450);
      await a.sleep(500);
      await a.tap('Weekly');
      await a.sleep(700);
      await a.scroll(-300, 400);
      await a.sleep(900);
    },
  },
  wheel: {
    theme: 'dark',
    async setup(a) {
      await a.tap('Schedule');
      await a.sleep(900);
      await a.tap('1:1 with Ana');
      await a.sleep(1000);
      await a.scrollTo('Pick from color wheel', 520);
      await a.sleep(500);
    },
    async run(a) {
      await a.sleep(300);
      await a.tap('Pick from color wheel');
      await a.sleep(900);
      // Sweep the wheel's handle around in an arc.
      // The wheel sits a fixed distance below the sheet's hex label.
      const hex = await a.find('#F2994A', { index: -1 });
      const cx = 195, cy = hex.y + 141;
      const at = (i) => {
        const ang = ((240 + 150 * (i / 60)) * Math.PI) / 180; // blue -> magenta -> red -> orange
        return [cx + 95 * Math.cos(ang), cy + 95 * Math.sin(ang)];
      };
      await a.page.evaluate(([x, y]) => window.__touch(x, y, 'start'), at(0));
      await a.page.touchscreen.touchStart(...at(0));
      for (let i = 1; i <= 60; i++) {
        const [x, y] = at(i);
        await a.page.touchscreen.touchMove(x, y);
        await a.page.evaluate((x, y) => window.__touch(x, y, 'move'), x, y);
        await a.sleep(20);
      }
      await a.page.touchscreen.touchEnd();
      await a.page.evaluate(() => window.__touch(0, 0, 'end'));
      await a.sleep(500);
      await a.tap('Save this color');
      await a.sleep(1000);
      await a.type('Sunset', 12);
      await a.sleep(300);
      await a.tap('Save color', { index: -1 });
      await a.sleep(900);
      await a.highlight('Sunset', { exact: false, index: -1 });
      await a.sleep(1200);
    },
  },
  dnd: {
    theme: 'dark',
    async setup(a) {
      await a.tap('Settings');
      await a.sleep(800);
      await a.tap('Notifications');
      await a.sleep(900);
      await a.hideWebNotice();
      await a.sleep(200);
    },
    async run(a) {
      await a.sleep(500);
      await a.tap('Add Do Not Disturb');
      await a.sleep(1000);
      await a.tap('Mondays 5–6 PM');
      await a.sleep(250);
      await a.highlight('Weekly');
      await a.sleep(850);
      await a.tap('Save');
      await a.sleep(1500);
    },
  },
};

async function recordClip(browser, name) {
  const clip = CLIPS[name];
  const page = await browser.newPage();
  await page.setViewport({ width: W, height: H, deviceScaleFactor: DPR, isMobile: true, hasTouch: true });
  const theme = clip.theme ?? 'light';
  await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: theme }]);
  page.on('framenavigated', (f) => f === page.mainFrame() && console.log('  navigated', f.url()));
  await page.goto(BASE, { waitUntil: 'domcontentloaded' });
  const { cals, events, templates } = demoData();
  await page.evaluate((c, e, t, s) => {
    localStorage.clear();
    localStorage.setItem('calendar-app.calendars', JSON.stringify(c));
    localStorage.setItem('calendar-app.events', JSON.stringify(e));
    localStorage.setItem('calendar-app.templates', JSON.stringify(t));
    localStorage.setItem('calendar-app.settings', JSON.stringify({ themeMode: s }));
  }, cals, events, templates, theme);
  await page.reload({ waitUntil: 'networkidle0' });
  await page.waitForFunction(() => document.body.innerText.includes('Schedule'), { timeout: 90000 });
  await page.evaluate(INJECT);
  await sleep(800);
  const api = makeApi(page);
  page.on('pageerror', (e) => console.log('  page error', e.message));
  const shotOnFail = (fn) => fn().catch(async (e) => {
    await page.screenshot({ path: path.join(OUT, `${name}-error.png`) }).catch(() => {});
    throw e;
  });
  if (clip.setup) await shotOnFail(() => clip.setup(api));
  await sleep(500);

  // Record.
  const dir = path.join(OUT, name); // frames stay: scenes show them by index
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const cdp = await page.createCDPSession();
  const frames = [];
  cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
    frames.push({ t: metadata.timestamp, data });
    cdp.send('Page.screencastFrameAck', { sessionId }).catch(() => {});
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 95, maxWidth: W * DPR, maxHeight: H * DPR, everyNthFrame: 1 });
  // Nudge a repaint so there's a first frame even on a static screen.
  await page.evaluate(() => window.__touch(-100, -100, 'end'));
  const t0 = Date.now() / 1000;
  api.log.length = 0;
  await shotOnFail(() => clip.run(api));
  const t1 = Date.now() / 1000;
  await cdp.send('Page.stopScreencast');
  await page.close();

  // Re-time to constant fps: each output frame shows the latest captured frame at that moment.
  frames.sort((a, b) => a.t - b.t);
  const start = Math.min(t0, frames[0].t);
  const n = Math.round((t1 - start) * FPS);
  let j = 0;
  for (let i = 0; i < n; i++) {
    const t = start + i / FPS;
    while (j + 1 < frames.length && frames[j + 1].t <= t) j++;
    fs.writeFileSync(path.join(dir, `${String(i).padStart(5, '0')}.jpg`), Buffer.from(frames[j].data, 'base64'));
  }
  const out = path.join(OUT, `${name}.mp4`);
  const r = spawnSync(FFMPEG, ['-y', '-loglevel', 'error', '-framerate', String(FPS), '-i', path.join(dir, '%05d.jpg'),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p', out], { stdio: 'inherit' });
  if (r.status !== 0) throw new Error('ffmpeg failed');
  const cues = api.log.map(({ at, ...c }) => ({ ...c, t: +(at - start).toFixed(3) }));
  fs.writeFileSync(path.join(OUT, `${name}.json`), JSON.stringify({ frames: n, fps: FPS, cues }));
  writeIndex();
  console.log(`${name}: ${(n / FPS).toFixed(2)}s from ${frames.length} captured frames -> ${out}`);
}

/** out/footage/footage.js: window.FOOTAGE = { clip: { frames, fps, cues } } for the scenes. */
function writeIndex() {
  const all = {};
  for (const f of fs.readdirSync(OUT).filter((f) => f.endsWith('.json'))) all[f.slice(0, -5)] = JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8'));
  fs.writeFileSync(path.join(OUT, 'footage.js'), `window.FOOTAGE = ${JSON.stringify(all)};
`);
}

async function stills(browser) {
  // Month view in light and dark for the theme-flip transition.
  for (const scheme of ['light', 'dark']) {
    const page = await browser.newPage();
    await page.setViewport({ width: W, height: H, deviceScaleFactor: DPR, isMobile: true, hasTouch: true });
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    const { cals, events, templates } = demoData();
    await page.evaluate((c, e, t, s) => {
      localStorage.clear();
      localStorage.setItem('calendar-app.calendars', JSON.stringify(c));
      localStorage.setItem('calendar-app.events', JSON.stringify(e));
      localStorage.setItem('calendar-app.templates', JSON.stringify(t));
      localStorage.setItem('calendar-app.settings', JSON.stringify({ themeMode: s }));
    }, cals, events, templates, scheme);
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForFunction(() => document.body.innerText.includes('Schedule'), { timeout: 90000 });
    await sleep(1200);
    await page.screenshot({ path: path.join(OUT, `month-${scheme}.png`) });
    await page.close();
    console.log(`still month-${scheme}`);
  }
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({
    executablePath: EDGE,
    headless: true,
    // A horizontal touch swipe would otherwise trigger the browser's swipe-back navigation.
    args: ['--hide-scrollbars', '--force-device-scale-factor=2', '--overscroll-history-navigation=0', '--disable-features=OverscrollHistoryNavigation'],
  });
  const names = args.length ? args : [...Object.keys(CLIPS), 'stills'];
  try {
    for (const name of names) {
      if (name === 'stills') await stills(browser);
      else await recordClip(browser, name);
    }
  } finally {
    await browser.close(); // also on failure, so no Edge instances are left behind
  }
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
