import { StackActions, type NavigationContainerRefWithCurrent } from '@react-navigation/native';
import { File } from 'expo-file-system';
import { useEffect, useRef } from 'react';
import { addShareListener, takeLaunchShare, type SharedItem } from '../../modules/opencal-share';
import { useCalendarContext } from '../context/CalendarContext';
import type { EventDraft, RootStackParamList } from '../navigation/types';
import { onIncomingFile } from '../services/incomingFiles';
import { parseInvite } from '../services/invite';
import { notify } from '../utils/confirm';

/** Long enough for the navigator to mount when a file launches the app cold. */
const READY_POLL_MS = 100;

/**
 * Opens what other apps send to OpenCal: calendar files and invite emails opened with it, and
 * anything shared to it from the Share menu. One event opens in the editor, filled in and unsaved
 * (an event already added from an earlier copy of the invite keeps its calendar, color and
 * reminders). A file with several events goes to Import & export. Shared text that isn't calendar
 * data goes to Quick Add, which finds the date and time in it.
 */
export function InviteWatcher({ navigation }: { navigation: NavigationContainerRefWithCurrent<RootStackParamList> }) {
  const { events, notificationPrefs } = useCalendarContext();
  const latest = useRef({ events, notificationPrefs });
  useEffect(() => {
    latest.current = { events, notificationPrefs };
  });

  useEffect(() => {
    const timers = new Set<ReturnType<typeof setTimeout>>();
    /** Runs `action` once the navigator is mounted. */
    const whenReady = (action: () => void) => {
      if (navigation.isReady()) return action();
      const timer = setTimeout(() => {
        timers.delete(timer);
        whenReady(action);
      }, READY_POLL_MS);
      timers.add(timer);
    };

    /** Opens calendar text; false when there's no calendar data in it. */
    const openCalendar = (text: string, name: string): boolean => {
      const data = parseInvite(text, latest.current.notificationPrefs.allDayTime);
      if (!data) return false;
      if (!data.events.length) {
        notify('No events found', `“${name}” doesn't contain any events.`);
        return true;
      }
      if (data.events.length > 1) {
        navigation.navigate('ImportExport', { incoming: { name, text } });
        return true;
      }
      const { id, calendarId: _none, reminders, tags, pauseWindows: _p, skippedDates: _s, ...fields } = data.events[0]!;
      const earlier = latest.current.events.find((e) => e.id === id);
      const draft: EventDraft = earlier
        ? { ...fields, calendarId: earlier.calendarId, reminders: earlier.reminders, tags: earlier.tags, color: earlier.color, emoji: earlier.emoji }
        : // Leave reminders and tags to the calendar's defaults unless the invite sets them.
          { ...fields, reminders: reminders.length ? reminders : undefined, tags: tags.length ? tags : undefined };
      navigation.navigate('EventEdit', { draft, importId: id });
      return true;
    };

    const openFile = async (uri: string) => {
      let text: string;
      let name = 'Invitation';
      try {
        const file = new File(uri);
        if (/\.(ics|eml|ical|ifb|vcs)$/i.test(file.name ?? '')) name = file.name;
        text = await file.text();
      } catch (e) {
        notify("Couldn't open the file", e instanceof Error ? e.message : String(e));
        return;
      }
      whenReady(() => {
        if (!openCalendar(text, name)) notify('No events found', "This file isn't a calendar invitation or an .ics file.");
      });
    };

    const openShare = (item: SharedItem) =>
      whenReady(() => {
        if (item.error) return notify("Couldn't open what was shared", item.error);
        const text = item.text ?? '';
        if (openCalendar(text, item.name ?? 'Invitation')) return;
        if (item.isFile && !item.type?.startsWith('text/plain')) {
          return notify('No events found', `“${item.name ?? 'The file'}” isn't a calendar invitation or an .ics file.`);
        }
        // A message or note: let Quick Add find the event in it.
        const shared = [item.subject, text].filter((s) => s?.trim()).join('\n').trim();
        // Pushed, so a second share while Quick Add is open gets its own screen with the new text.
        if (shared) navigation.dispatch(StackActions.push('QuickAdd', { sharedText: shared }));
      });

    const stopFiles = onIncomingFile((uri) => void openFile(uri));
    const stopShares = addShareListener(openShare);
    void takeLaunchShare()
      .then((item) => item && openShare(item))
      .catch(() => undefined);
    return () => {
      stopFiles();
      stopShares();
      timers.forEach(clearTimeout);
    };
  }, [navigation]);
  return null;
}
