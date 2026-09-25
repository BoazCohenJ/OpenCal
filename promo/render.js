// Renders a scene (scenes/*.html) frame by frame with headless Edge and encodes it with ffmpeg.
// Scenes are pure functions of time (see scenes/lib.js), so output is deterministic.
//   node render.js scenes/intro.html out/intro.mp4            full clip (+ out/intro.cues.json)
//   node render.js scenes/intro.html out/stills --stills 1,2.5  PNG stills at those seconds
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const puppeteer = require('puppeteer-core');

const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const FFMPEG = fs.existsSync('D:\\FFmpeg\\bin\\ffmpeg.exe') ? 'D:\\FFmpeg\\bin\\ffmpeg.exe' : 'ffmpeg';
const FPS = 30;

const [scene, out, ...rest] = process.argv.slice(2);
const opt = (name) => {
  const i = rest.indexOf(`--${name}`);
  return i >= 0 ? rest[i + 1] : undefined;
};

let browser;
async function main() {
  browser = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ['--hide-scrollbars', '--allow-file-access-from-files'] });
  const page = await browser.newPage();
  page.on('console', (m) => console.log('[scene]', m.text()));
  page.on('pageerror', (e) => console.error('[scene error]', e.message));
  await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
  await page.goto('file:///' + path.resolve(scene).replace(/\\/g, '/'), { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.waitForFunction(() => typeof window.seek === 'function');
  const duration = await page.evaluate(() => window.DURATION);

  const frame = async (t) => {
    await page.evaluate((t) => window.seek(t), t);
    return page.screenshot({ type: 'png', optimizeForSpeed: true });
  };

  const stills = opt('stills');
  if (stills) {
    fs.mkdirSync(out, { recursive: true });
    const base = path.basename(scene, '.html');
    for (const t of stills.split(',').map(Number)) {
      fs.writeFileSync(path.join(out, `${base}-${t.toFixed(2)}.png`), await frame(t));
      console.log('still', t);
    }
    await browser.close();
    return;
  }

  fs.mkdirSync(path.dirname(out), { recursive: true });
  const cues = await page.evaluate(() => window.CUES || []);
  const markers = await page.evaluate(() => window.MARKERS || {});
  fs.writeFileSync(out.replace(/\.mp4$/, '.cues.json'), JSON.stringify({ duration, markers, cues }, null, 1));
  const ff = spawn(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'png', '-i', '-',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', '-pix_fmt', 'yuv420p', out], { stdio: ['pipe', 'inherit', 'inherit'] });
  const frames = Math.round(duration * FPS);
  for (let i = 0; i < frames; i++) {
    const buf = await frame(i / FPS);
    if (!ff.stdin.write(buf)) await new Promise((r) => ff.stdin.once('drain', r));
    if (i % FPS === 0) process.stdout.write(`\r${scene}: ${i}/${frames}`);
  }
  ff.stdin.end();
  await new Promise((r) => ff.on('close', r));
  console.log(`\nwrote ${out} (${duration}s, ${frames} frames)`);
  await browser.close();
}

main().catch(async (e) => {
  await browser?.close().catch(() => {});
  console.error(e);
  process.exit(1);
});
