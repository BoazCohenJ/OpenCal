import * as SQLite from 'expo-sqlite';
import { Calendar } from '../models/Calendar';
import { Event, PauseWindow } from '../models/Event';

// Open the database
const db = SQLite.openDatabaseSync('calendar.db');

// Initialize the database and create tables if they don't exist
export const initDatabase = () => {
  try {
    db.withTransactionSync(() => {
      // Create calendars table
      db.execSync(
        `CREATE TABLE IF NOT EXISTS calendars (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          color TEXT NOT NULL
        );`
      );

      // Create events table
      db.execSync(
        `CREATE TABLE IF NOT EXISTS events (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          description TEXT,
          startDate TEXT NOT NULL,
          endDate TEXT NOT NULL,
          isAllDay BOOLEAN NOT NULL,
          location TEXT,
          calendarId TEXT NOT NULL,
          color TEXT,
          recurrenceRule TEXT,
          reminders TEXT, -- JSON array of numbers
          emoji TEXT,
          tags TEXT, -- JSON array of strings
          FOREIGN KEY (calendarId) REFERENCES calendars(id)
        );`
      );

      // Create pause_windows table (since an event can have multiple pause windows)
      db.execSync(
        `CREATE TABLE IF NOT EXISTS pause_windows (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          eventId TEXT NOT NULL,
          startDate TEXT NOT NULL,
          endDate TEXT NOT NULL,
          FOREIGN KEY (eventId) REFERENCES events(id) ON DELETE CASCADE
        );`
      );
    });
    console.log('Database initialized successfully');
  } catch (error) {
    console.log('Error initializing database: ', error);
  }
};

// Calendar CRUD operations
export const getCalendars = (callback: (calendars: Calendar[]) => void) => {
  try {
    const rows = db.getAllSync('SELECT * FROM calendars');
    const calendars: Calendar[] = rows.map((row: any) => ({
      id: row.id,
      name: row.name,
      color: row.color
    }));
    callback(calendars);
  } catch (error) {
    console.log('Error getting calendars: ', error);
    callback([]);
  }
};

export const createCalendar = (calendar: Calendar, callback: (id: string) => void) => {
  try {
    const result = db.runSync(
      `INSERT INTO calendars (id, name, color) VALUES (?, ?, ?)`,
      [calendar.id, calendar.name, calendar.color]
    );
    callback(calendar.id);
  } catch (error) {
    console.log('Error creating calendar: ', error);
  }
};

export const updateCalendar = (calendar: Calendar, callback: () => void) => {
  try {
    db.runSync(
      `UPDATE calendars SET name = ?, color = ? WHERE id = ?`,
      [calendar.name, calendar.color, calendar.id]
    );
    callback();
  } catch (error) {
    console.log('Error updating calendar: ', error);
  }
};

export const deleteCalendar = (id: string, callback: () => void) => {
  try {
    db.runSync('DELETE FROM calendars WHERE id = ?', [id]);
    callback();
  } catch (error) {
    console.log('Error deleting calendar: ', error);
  }
};

// Event CRUD operations
export const getEvents = (callback: (events: Event[]) => void) => {
  try {
    // First get all events
    const eventRows = db.getAllSync('SELECT * FROM events');
    const events: Event[] = eventRows.map((row: any) => {
      // Get pause windows for this event
      const pauseWindowRows = db.getAllSync(
        `SELECT startDate, endDate FROM pause_windows WHERE eventId = ?`,
        [row.id]
      );
      const pauseWindows: PauseWindow[] = pauseWindowRows.map((pwRow: any) => ({
        startDate: pwRow.startDate,
        endDate: pwRow.endDate
      }));

      return {
        id: row.id,
        title: row.title,
        description: row.description,
        startDate: row.startDate,
        endDate: row.endDate,
        isAllDay: row.isAllDay === 1,
        location: row.location,
        calendarId: row.calendarId,
        color: row.color,
        recurrenceRule: row.recurrenceRule,
        reminders: row.reminders ? JSON.parse(row.reminders) : [],
        emoji: row.emoji,
        tags: row.tags ? JSON.parse(row.tags) : [],
        pauseWindows: pauseWindows
      };
    });
    callback(events);
  } catch (error) {
    console.log('Error getting events: ', error);
    callback([]);
  }
};

export const createEvent = (event: Event, callback: (id: string) => void) => {
  try {
    db.withTransactionSync(() => {
      // Insert the event
      const result = db.runSync(
        `INSERT INTO events (
          id, title, description, startDate, endDate, isAllDay, location, calendarId, color, recurrenceRule, reminders, emoji, tags
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          event.id,
          event.title,
          event.description ?? null,
          event.startDate,
          event.endDate,
          event.isAllDay ? 1 : 0,
          event.location ?? null,
          event.calendarId,
          event.color ?? null,
          event.recurrenceRule ?? null,
          JSON.stringify(event.reminders),
          event.emoji ?? null,
          JSON.stringify(event.tags),
        ]
      );

      // Insert pause windows
      for (const pw of event.pauseWindows) {
        db.runSync(
          `INSERT INTO pause_windows (eventId, startDate, endDate) VALUES (?, ?, ?)`,
          [event.id, pw.startDate, pw.endDate]
        );
      }
    });
    callback(event.id);
  } catch (error) {
    console.log('Error creating event: ', error);
  }
};

export const updateEvent = (event: Event, callback: () => void) => {
  try {
    db.withTransactionSync(() => {
      // Update the event
      db.runSync(
        `UPDATE events SET
          title = ?,
          description = ?,
          startDate = ?,
          endDate = ?,
          isAllDay = ?,
          location = ?,
          calendarId = ?,
          color = ?,
          recurrenceRule = ?,
          reminders = ?,
          emoji = ?,
          tags = ?
        WHERE id = ?`,
        [
          event.title,
          event.description ?? null,
          event.startDate,
          event.endDate,
          event.isAllDay ? 1 : 0,
          event.location ?? null,
          event.calendarId,
          event.color ?? null,
          event.recurrenceRule ?? null,
          JSON.stringify(event.reminders),
          event.emoji ?? null,
          JSON.stringify(event.tags),
          event.id
        ]
      );

      // Delete existing pause windows for this event
      db.runSync('DELETE FROM pause_windows WHERE eventId = ?', [event.id]);

      // Insert the new pause windows
      for (const pw of event.pauseWindows) {
        db.runSync(
          `INSERT INTO pause_windows (eventId, startDate, endDate) VALUES (?, ?, ?)`,
          [event.id, pw.startDate, pw.endDate]
        );
      }
    });
    callback();
  } catch (error) {
    console.log('Error updating event: ', error);
  }
};

export const deleteEvent = (id: string, callback: () => void) => {
  try {
    db.runSync('DELETE FROM events WHERE id = ?', [id]);
    callback();
  } catch (error) {
    console.log('Error deleting event: ', error);
  }
};

// Pause windows operations
export const getPauseWindowsForEvent = (eventId: string, callback: (pauseWindows: PauseWindow[]) => void) => {
  try {
    const rows = db.getAllSync(
      `SELECT startDate, endDate FROM pause_windows WHERE eventId = ?`,
      [eventId]
    );
    const pauseWindows: PauseWindow[] = rows.map((row: any) => ({
      startDate: row.startDate,
      endDate: row.endDate
    }));
    callback(pauseWindows);
  } catch (error) {
    console.log('Error getting pause windows for event: ', error);
    callback([]);
  }
};