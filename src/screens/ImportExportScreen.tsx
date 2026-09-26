import { format } from 'date-fns';
import React, { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useToast } from '../components/Toast';
import { Button, Chip, Divider, Field, Row, Section, TextField } from '../components/ui';
import { useCalendarContext } from '../context/CalendarContext';
import type { ScreenProps } from '../navigation/types';
import { parseBackup, type Backup } from '../services/backup';
import { shareBackup, shareICS } from '../services/exports';
import { pickTextFile } from '../services/fileTransfer';
import { parseICS, type ICSImport } from '../services/ical';
import { createStyles, PALETTE, spacing } from '../theme';
import { confirmAsync, notify } from '../utils/confirm';

type Pending =
  | { kind: 'backup'; fileName: string; backup: Backup }
  | { kind: 'ics'; fileName: string; data: ICSImport };

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const NEW_CALENDAR = '__new__';

export function ImportExportScreen({ navigation }: ScreenProps<'ImportExport'>) {
  const styles = useStyles();
  const showToast = useToast();
  const {
    calendars,
    calendarsById,
    events,
    templates,
    birthdays,
    notificationPrefs,
    createBackupFile,
    importBackup,
    importEvents,
  } = useCalendarContext();

  // Export to other apps: which calendars go in the .ics file (all by default).
  const [excluded, setExcluded] = useState<string[]>([]);
  const chosen = calendars.filter((c) => !excluded.includes(c.id));
  const chosenEvents = events.filter((e) => !excluded.includes(e.calendarId));

  const [pending, setPending] = useState<Pending | null>(null);
  const [target, setTarget] = useState<string>(NEW_CALENDAR);
  const [newName, setNewName] = useState('');
  const [busy, setBusy] = useState(false);

  const exportIcs = () => {
    const only = chosen.length === 1 ? chosen[0] : undefined;
    void shareICS(only?.name ?? 'OpenCal', chosenEvents, calendarsById, notificationPrefs.allDayTime, only?.color);
  };

  const choose = async () => {
    setBusy(true);
    try {
      const file = await pickTextFile();
      if (!file) return;
      const backup = parseBackup(file.text);
      if (backup) {
        setPending({ kind: 'backup', fileName: file.name, backup });
        return;
      }
      const data = parseICS(file.text, notificationPrefs.allDayTime);
      if (data) {
        if (!data.events.length) {
          notify('No events found', `“${file.name}” doesn't contain any events.`);
          return;
        }
        setPending({ kind: 'ics', fileName: file.name, data });
        setTarget(NEW_CALENDAR);
        setNewName(data.calendarName ?? file.name.replace(/\.[^.]+$/, ''));
        return;
      }
      notify('Unsupported file', `“${file.name}” isn't an OpenCal backup (.json) or a calendar file (.ics).`);
    } catch (e) {
      notify('Import failed', e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const restore = async (mode: 'merge' | 'replace') => {
    if (pending?.kind !== 'backup') return;
    if (
      mode === 'replace' &&
      !(await confirmAsync(
        'Replace everything?',
        `All ${plural(events.length, 'event')}, ${plural(calendars.length, 'calendar')}, stamps, birthdays and settings on this device will be replaced by the backup. This can't be undone.`,
        'Replace',
        true,
      ))
    ) {
      return;
    }
    const s = importBackup(pending.backup, mode);
    setPending(null);
    showToast({ icon: 'check', message: `${mode === 'replace' ? 'Restored' : 'Merged'} ${plural(s.events, 'event')} in ${plural(s.calendars, 'calendar')}` });
  };

  const addEvents = () => {
    if (pending?.kind !== 'ics') return;
    const name = newName.trim();
    if (target === NEW_CALENDAR && !name) {
      notify('Name the new calendar');
      return;
    }
    const color = pending.data.calendarColor ?? PALETTE.find((c) => !calendars.some((x) => x.color === c)) ?? PALETTE[0]!;
    const { added, updated } = importEvents(
      pending.data.events,
      target === NEW_CALENDAR ? { newCalendar: { name, color } } : { calendarId: target },
    );
    setPending(null);
    showToast({ icon: 'check', message: `Imported ${plural(added, 'event')}${updated ? `, updated ${updated}` : ''}` });
  };

  return (
    <ScrollView style={styles.screen} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
      {pending?.kind === 'backup' ? (
        <Section title="Ready to import">
          <View style={styles.pending}>
            <Text style={styles.pendingTitle}>{pending.fileName}</Text>
            <Text style={styles.pendingMeta}>
              {pending.backup.exportedAt ? `Backup from ${format(new Date(pending.backup.exportedAt), 'MMM d, yyyy, h:mm a')} · ` : ''}
              {[
                plural(pending.backup.calendars.length, 'calendar'),
                plural(pending.backup.events.length, 'event'),
                plural(pending.backup.templates.length, 'stamp'),
                plural(pending.backup.birthdays.length, 'birthday'),
              ].join(', ')}
            </Text>
            <Text style={styles.hint}>
              Merge adds the backup to what’s here (items already on this device are updated, nothing is deleted). Replace
              makes this device an exact copy of the backup, settings included.
            </Text>
            <Button title="Merge into this device" onPress={() => void restore('merge')} />
            <Button variant="danger" title="Replace everything…" onPress={() => void restore('replace')} />
            <Button variant="ghost" title="Cancel" onPress={() => setPending(null)} />
          </View>
        </Section>
      ) : null}

      {pending?.kind === 'ics' ? (
        <Section title="Ready to import">
          <View style={styles.pending}>
            <Text style={styles.pendingTitle}>{pending.fileName}</Text>
            <Text style={styles.pendingMeta}>
              {plural(pending.data.events.length, 'event')}
              {pending.data.events.some((e) => e.recurrenceRule) ? ` (${pending.data.events.filter((e) => e.recurrenceRule).length} repeating)` : ''}
              {pending.data.skipped ? ` · ${pending.data.skipped} couldn't be read` : ''}
            </Text>
            <Text style={styles.label}>ADD TO</Text>
            <View style={styles.chips}>
              <Chip label="New calendar" selected={target === NEW_CALENDAR} onPress={() => setTarget(NEW_CALENDAR)} />
              {calendars.map((c) => (
                <Chip key={c.id} label={c.name} color={c.color} selected={target === c.id} onPress={() => setTarget(c.id)} />
              ))}
            </View>
            {target === NEW_CALENDAR ? <TextField value={newName} onChangeText={setNewName} placeholder="Calendar name" /> : null}
            <Button title={`Import ${plural(pending.data.events.length, 'event')}`} onPress={addEvents} />
            <Button variant="ghost" title="Cancel" onPress={() => setPending(null)} />
          </View>
        </Section>
      ) : null}

      <Section title="Back up" footer="One file with everything on this device. Keep it somewhere safe, or use it to move OpenCal to a new phone.">
        <Row
          label="Export full backup"
          subtitle={`${plural(calendars.length, 'calendar')}, ${plural(events.length, 'event')}, ${plural(templates.length, 'stamp')}, ${plural(birthdays.length, 'birthday')} and settings (.json)`}
          onPress={() => void shareBackup(createBackupFile())}
        />
      </Section>

      <Section
        title="Export to other apps"
        footer="A standard calendar file (.ics) that Google Calendar, Apple Calendar and Outlook can import. Stamps, birthdays and settings are only in the full backup."
      >
        <Field label="Calendars">
          <View style={styles.chips}>
            {calendars.map((c) => (
              <Chip
                key={c.id}
                label={c.name}
                color={c.color}
                selected={!excluded.includes(c.id)}
                onPress={() => setExcluded((x) => (x.includes(c.id) ? x.filter((id) => id !== c.id) : [...x, c.id]))}
              />
            ))}
          </View>
        </Field>
        <Divider />
        <View style={styles.action}>
          <Button
            title={`Export ${plural(chosenEvents.length, 'event')} (.ics)`}
            disabled={!chosenEvents.length}
            onPress={exportIcs}
          />
        </View>
      </Section>

      <Section title="Import" footer="Pick an OpenCal backup (.json) or a calendar file (.ics) exported from any calendar app. You'll see what's in it before anything changes.">
        <View style={styles.action}>
          <Button variant="secondary" title={busy ? 'Opening…' : 'Choose a file…'} disabled={busy} onPress={() => void choose()} />
        </View>
      </Section>

      <Text style={styles.tip}>
        Tip: to export only some events, filter them in Settings → Event list and tap Export there.
      </Text>
      <Button variant="ghost" title="Open event list" onPress={() => navigation.navigate('HiddenEvents')} />
    </ScrollView>
  );
}

const useStyles = createStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, paddingBottom: 48 },
  pending: { padding: spacing.lg, gap: 10 },
  pendingTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
  pendingMeta: { fontSize: 14, color: colors.textMuted },
  hint: { fontSize: 13, color: colors.textMuted, lineHeight: 19, marginBottom: 4 },
  label: { fontSize: 11, fontWeight: '700', letterSpacing: 1.4, color: colors.textMuted, marginTop: 4 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  action: { padding: spacing.md },
  tip: { fontSize: 13, color: colors.textMuted, textAlign: 'center', marginBottom: 4, paddingHorizontal: spacing.md },
}));
