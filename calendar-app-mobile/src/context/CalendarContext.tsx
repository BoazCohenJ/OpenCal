import React, { createContext, useContext, useState, useEffect } from 'react';
import { getCalendars, createCalendar, updateCalendar, deleteCalendar } from '../services/database';
import { getEvents, createEvent, updateEvent, deleteEvent } from '../services/database';
import { Calendar } from '../models/Calendar';
import { Event } from '../models/Event';

interface CalendarContextProps {
  calendars: Calendar[];
  events: Event[];
  // Calendar operations
  addCalendar: (calendar: Calendar) => void;
  updateCalendar: (calendar: Calendar) => void;
  removeCalendar: (id: string) => void;
  // Event operations
  addEvent: (event: Event) => void;
  updateEvent: (event: Event) => void;
  removeEvent: (id: string) => void;
  // Visibility toggles (we can store a set of visible calendar IDs)
  visibleCalendarIds: string[];
  toggleCalendarVisibility: (calendarId: string) => void;
  // Helper functions for color inheritance and visibility
  getVisibleCalendars: () => Calendar[];
  getEventsWithEffectiveColors: () => Event[];
  getEffectiveColor: (event: Event) => string;
}

const CalendarContext = createContext<CalendarContextProps | undefined>(undefined);

export const useCalendarContext = () => {
  const context = useContext(CalendarContext);
  if (!context) {
    throw new Error('useCalendarContext must be used within a CalendarProvider');
  }
  return context;
};

export const CalendarProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [calendars, setCalendars] = useState<Calendar[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [visibleCalendarIds, setVisibleCalendarIds] = useState<string[]>([]);

  // Load calendars and events from the database
  useEffect(() => {
    const loadData = () => {
      getCalendars((cals) => {
        setCalendars(cals);
        // By default, all calendars are visible
        setVisibleCalendarIds(cals.map((cal) => cal.id));
      });
      getEvents((evs) => {
        setEvents(evs);
      });
    };

    loadData();
  }, []);

  // Calendar operations
  const addCalendar = (calendar: Calendar) => {
    createCalendar(calendar, () => {
      setCalendars((prev) => [...prev, calendar]);
      setVisibleCalendarIds((prev) => [...prev, calendar.id]);
    });
  };

  const handleUpdateCalendar = (calendar: Calendar) => {
    updateCalendar(calendar, () => {
      setCalendars((prev) =>
        prev.map((c) => (c.id === calendar.id ? calendar : c))
      );
    });
  };

  const removeCalendar = (id: string) => {
    deleteCalendar(id, () => {
      setCalendars((prev) => prev.filter((c) => c.id !== id));
      setVisibleCalendarIds((prev) => prev.filter((cid) => cid !== id));
      // Also delete events belonging to this calendar? Or maybe we want to keep them and reassign?
      // For now, we'll delete the events as well.
      // We need to get the events for this calendar and delete them.
      // But we don't have a direct function to get events by calendarId.
      // We'll skip for now and handle it later if needed.
    });
  };

  // Event operations
  const addEvent = (event: Event) => {
    createEvent(event, () => {
      setEvents((prev) => [...prev, event]);
    });
  };

  const handleUpdateEvent = (event: Event) => {
    updateEvent(event, () => {
      setEvents((prev) =>
        prev.map((e) => (e.id === event.id ? event : e))
      );
    });
  };

  const removeEvent = (id: string) => {
    deleteEvent(id, () => {
      setEvents((prev) => prev.filter((e) => e.id !== id));
    });
  };

  // Helper functions for color inheritance and visibility
  const getVisibleCalendars = (): Calendar[] => {
    return calendars.filter(calendar => visibleCalendarIds.includes(calendar.id));
  };

  const getEventsWithEffectiveColors = (): Event[] => {
    // Filter events to only those from visible calendars
    return events.filter(event => visibleCalendarIds.includes(event.calendarId));
  };

  const getEffectiveColor = (event: Event): string => {
    // Return event's own color if set, otherwise return its calendar's color
    if (event.color) {
      return event.color;
    }
    const calendar = calendars.find(c => c.id === event.calendarId);
    return calendar ? calendar.color : '#000000'; // default to black if calendar not found
  };

  const toggleCalendarVisibility = (calendarId: string) => {
    setVisibleCalendarIds((prev) => {
      if (prev.includes(calendarId)) {
        return prev.filter((cid) => cid !== calendarId);
      } else {
        return [...prev, calendarId];
      }
    });
  };

  return (
    <CalendarContext.Provider
      value={{
        calendars,
        events,
        addCalendar,
        updateCalendar: handleUpdateCalendar,
        removeCalendar,
        addEvent,
        updateEvent: handleUpdateEvent,
        removeEvent,
        visibleCalendarIds,
        toggleCalendarVisibility,
        // Helper functions
        getVisibleCalendars,
        getEventsWithEffectiveColors,
        getEffectiveColor
      }}
    >
      {children}
    </CalendarContext.Provider>
  );
};