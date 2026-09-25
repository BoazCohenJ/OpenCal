// Captures README screenshots of the web build with seeded demo data.
// Usage: node shots.js <baseUrl> <outDir>
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');

const [BASE = 'http://localhost:8082', OUT = './shots'] = process.argv.slice(2);
const EDGE = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Demo data seeded into the web build's localStorage (same shape as database.web.ts). */
function demoData() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const at = (dayOffset, h, m = 0) => {
    const d = new Date(today);
    d.setDate(d.getDate() + dayOffset);
    d.setHours(h, m, 0, 0);
    return d.toISOString();
  };
  const cals = [
    { id: 'personal', name: 'Personal', color: '#4F6BED', sortOrder: 0, pauseWindows: [] },
    { id: 'work', name: 'Work', color: '#F2994A', sortOrder: 1, pauseWindows: [], defaults: { reminders: [10], location: 'Studio' } },
    { id: 'fitness', name: 'Fitness', color: '#10B981', sortOrder: 2, pauseWindows: [] },
  ];
  let n = 0;
  const ev = (cal, title, day, h1, m1, h2, m2, extra = {}) => ({
    id: `demo${n++}`,
    title,
    calendarId: cal,
    startDate: at(day, h1, m1),
    endDate: at(day, h2, m2),
    isAllDay: false,
    pauseWindows: [],
    reminders: [10],
    tags: [],
    ...extra,
  });
  const dow = today.getDay();
  const events = [
    ev('work', 'Design review', 0, 10, 0, 11, 0, { emoji: 'icon:work', location: 'Studio' }),
    ev('personal', 'Lunch with Sam', 0, 12, 30, 13, 30, { emoji: 'icon:meal', location: 'Cafe Nero' }),
    ev('work', '1:1 with Ana', 0, 15, 0, 15, 30, { emoji: 'icon:call' }),
    ev('fitness', 'Evening run', 0, 18, 0, 19, 0, { emoji: 'icon:walk', recurrenceRule: 'FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR' }),
    ev('work', 'Standup', -dow + 1, 9, 30, 9, 45, { recurrenceRule: 'FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,TU,WE,TH,FR' }),
    ev('personal', 'Dentist', 3, 8, 30, 9, 15, { emoji: 'icon:doctor' }),
    ev('work', 'Sprint planning', 4, 11, 0, 12, 30, { emoji: 'icon:laptop' }),
    ev('personal', 'Dinner party', 1, 19, 30, 22, 0, { emoji: 'icon:drinks', location: "Maya's place" }),
    ev('fitness', 'Yoga', 2, 7, 0, 8, 0, { emoji: 'icon:gym' }),
    ev('personal', 'Coffee with John', -2, 16, 0, 16, 45, { emoji: 'icon:coffee' }),
    ev('personal', 'Movie night', 5, 20, 0, 22, 30, { emoji: 'icon:movie' }),
    ev('work', 'Offsite', 8, 0, 0, 23, 59, { isAllDay: true, emoji: 'icon:travel' }),
    ev('personal', "Mom's birthday", 11, 0, 0, 23, 59, { isAllDay: true, emoji: 'icon:cake' }),
  ];
  const templates = [
    { id: 't1', name: 'Coffee', title: 'Coffee with John', emoji: 'icon:coffee', durationMinutes: 45, isAllDay: false, calendarId: 'personal', reminders: [5], tags: [], sortOrder: 0 },
    { id: 't2', name: 'Gym', title: 'Gym session', emoji: 'icon:gym', durationMinutes: 75, isAllDay: false, calendarId: 'fitness', reminders: [15], tags: [], sortOrder: 1 },
  ];
  return { cals, events, templates };
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await puppeteer.launch({ executablePath: EDGE, headless: true, args: ['--hide-scrollbars'] });
  const shoot = async (name, { scheme = 'light', setup }) => {
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
    await page.emulateMediaFeatures([{ name: 'prefers-color-scheme', value: scheme }]);
    await page.goto(BASE, { waitUntil: 'domcontentloaded' });
    const { cals, events, templates } = demoData();
    await page.evaluate(
      (c, e, t) => {
        localStorage.setItem('calendar-app.calendars', JSON.stringify(c));
        localStorage.setItem('calendar-app.events', JSON.stringify(e));
        localStorage.setItem('calendar-app.templates', JSON.stringify(t));
        localStorage.setItem('calendar-app.settings', JSON.stringify({ themeMode: 'system' }));
      },
      cals,
      events,
      templates,
    );
    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForFunction(() => document.body.innerText.includes('Schedule'), { timeout: 60000 });
    await sleep(800);
    if (setup) await setup(page);
    await sleep(900);
    await page.screenshot({ path: path.join(OUT, `${name}.png`) });
    console.log('shot', name);
    await page.close();
  };
  const clickText = (page, text) =>
    page.evaluate((t) => {
      const el = [...document.querySelectorAll('div')].filter((d) => d.textContent === t).pop();
      el?.click();
    }, text);
  const clickLabel = (page, label) => page.evaluate((l) => document.querySelector(`[aria-label="${l}"]`)?.click(), label);

  await shoot('month', {});
  await shoot('week', { setup: (p) => clickText(p, 'Week') });
  await shoot('day', { setup: (p) => clickText(p, 'Day') });
  await shoot('schedule', { setup: (p) => clickText(p, 'Schedule') });
  await shoot('month-dark', { scheme: 'dark' });
  await shoot('day-dark', { scheme: 'dark', setup: (p) => clickText(p, 'Day') });
  await shoot('event-editor', {
    setup: async (p) => {
      await p.evaluate(() => {
        const el = [...document.querySelectorAll('div')].filter((d) => d.textContent?.startsWith('Design review')).pop();
        el?.click();
      });
      await sleep(400);
      await clickText(p, 'Day');
      await sleep(600);
      await p.evaluate(() => {
        const el = [...document.querySelectorAll('div')].filter((d) => d.textContent?.startsWith('Design review')).pop();
        el?.click();
      });
    },
  });
  await shoot('notifications', {
    setup: async (p) => {
      await clickLabel(p, 'Settings');
      await sleep(700);
      await clickText(p, 'Notifications');
    },
  });
  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
