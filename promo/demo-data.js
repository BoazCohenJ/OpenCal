// Demo data seeded into the web build's localStorage (same shape as src/services/database.web.ts).
// Relative to "today" so the calendar always looks lived-in around the recording date.
function demoData(now = new Date()) {
  const today = new Date(now);
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
  const allDay = (cal, title, day, extra = {}) => ev(cal, title, day, 0, 0, 23, 59, { isAllDay: true, ...extra });
  const dow = today.getDay();
  const monday = -dow + 1;
  const events = [
    // Recurring backbone, started weeks ago so past weeks aren't empty.
    ev('work', 'Standup', monday - 35, 9, 30, 9, 45, { recurrenceRule: 'FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,TU,WE,TH,FR' }),
    ev('fitness', 'Evening run', monday - 35, 18, 0, 19, 0, { emoji: 'icon:walk', recurrenceRule: 'FREQ=WEEKLY;INTERVAL=1;BYDAY=MO,WE,FR' }),
    ev('fitness', 'Yoga', monday - 29, 7, 0, 8, 0, { emoji: 'icon:gym', recurrenceRule: 'FREQ=WEEKLY;INTERVAL=1;BYDAY=SA' }),
    // Today and this week.
    ev('personal', 'Emails', 0, 8, 0, 8, 45, { emoji: 'icon:write' }),
    ev('work', 'Design review', 0, 10, 0, 11, 0, { emoji: 'icon:work', location: 'Studio' }),
    ev('work', '1:1 with Ana', 0, 15, 0, 15, 30, { emoji: 'icon:call' }),
    ev('personal', 'Coffee with John', -2, 16, 0, 16, 45, { emoji: 'icon:coffee' }),
    ev('personal', 'Dinner party', 1, 19, 30, 22, 0, { emoji: 'icon:drinks', location: "Maya's place" }),
    ev('personal', 'Dentist', 3, 8, 30, 9, 15, { emoji: 'icon:doctor' }),
    ev('work', 'Sprint planning', 4, 11, 0, 12, 30, { emoji: 'icon:laptop' }),
    ev('personal', 'Movie night', 5, 20, 0, 22, 30, { emoji: 'icon:movie' }),
    // Scattered one-offs, past and future.
    ev('personal', 'Farmers market', -20, 10, 0, 12, 0, { emoji: 'icon:shopping' }),
    ev('work', 'Quarterly review', -17, 14, 0, 16, 0, { emoji: 'icon:work' }),
    ev('personal', 'Book club', -13, 19, 0, 21, 0, { emoji: 'icon:study' }),
    ev('personal', 'Haircut', -9, 12, 0, 12, 45, { emoji: 'icon:haircut' }),
    ev('work', 'Client call', -6, 11, 0, 11, 30, { emoji: 'icon:call' }),
    ev('personal', 'Brunch', -12, 11, 0, 12, 30, { emoji: 'icon:meal' }),
    ev('work', 'Workshop', 9, 9, 0, 17, 0, { emoji: 'icon:laptop' }),
    ev('personal', 'Concert', 13, 20, 0, 23, 0, { emoji: 'icon:music' }),
    ev('personal', 'Vet visit', 16, 17, 0, 17, 30, { emoji: 'icon:pet' }),
    ev('work', 'Team lunch', 18, 12, 30, 13, 30, { emoji: 'icon:meal' }),
    ev('personal', 'Pottery class', 22, 18, 30, 20, 0),
    allDay('work', 'Offsite', 8, { emoji: 'icon:travel' }),
    allDay('personal', "Mom's birthday", 11, { emoji: 'icon:cake' }),
    allDay('personal', 'Weekend trip', 26, { emoji: 'icon:travel' }),
  ];
  const templates = [
    { id: 't1', name: 'Coffee', title: 'Coffee with John', emoji: 'icon:coffee', durationMinutes: 45, isAllDay: false, calendarId: 'personal', reminders: [5], tags: [], sortOrder: 0 },
    { id: 't2', name: 'Gym', title: 'Gym session', emoji: 'icon:gym', durationMinutes: 75, isAllDay: false, calendarId: 'fitness', reminders: [15], tags: [], sortOrder: 1 },
    { id: 't3', name: 'Deep work', title: 'Deep work', emoji: 'icon:laptop', durationMinutes: 120, isAllDay: false, calendarId: 'work', reminders: [], tags: [], sortOrder: 2 },
  ];
  return { cals, events, templates };
}

module.exports = { demoData };
