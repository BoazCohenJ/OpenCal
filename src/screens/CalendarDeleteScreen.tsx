import React, { useLayoutEffect, useMemo, useState } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { EventGlyph, eventIconKey, Icon } from '../components/Icon';
import { Button, Chip, ColorDot, EmptyState } from '../components/ui';
import { useCalendarContext } from '../context/CalendarContext';
import type { ScreenProps } from '../navigation/types';
import { nextOccurrence } from '../services/occurrences';
import { createStyles, fonts, radius, spacing, useTheme } from '../theme';
import { confirmAsync } from '../utils/confirm';
import { formatRange, parseTimestamp } from '../utils/dates';
import { eventLabel } from '../utils/format';
import { animateNextLayout } from '../utils/motion';
import { describeRRule } from '../utils/recurrence';

/** A target calendar id, or null for "delete this event". */
type Fate = string | null;

/** Delete a calendar, choosing per event whether it moves to another calendar or is deleted. */
export function CalendarDeleteScreen({ navigation, route }: ScreenProps<'CalendarDelete'>) {
  const styles = useStyles();
  const { colors } = useTheme();
  const { calendars, calendarsById, events, deleteCalendarWithPlan } = useCalendarContext();
  const calendar = calendarsById[route.params.calendarId];
  const others = calendars.filter((c) => c.id !== route.params.calendarId);
  const own = useMemo(
    () => events.filter((e) => e.calendarId === route.params.calendarId).sort((a, b) => a.startDate.localeCompare(b.startDate)),
    [events, route.params.calendarId],
  );
  const [target, setTarget] = useState<string>(others[0]?.id ?? '');
  const [fates, setFates] = useState<Record<string, Fate>>(() =>
    Object.fromEntries(own.map((e) => [e.id, others[0]?.id ?? null])),
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());

  useLayoutEffect(() => {
    navigation.setOptions({ title: calendar ? `Delete “${calendar.name}”` : 'Delete calendar' });
  }, [navigation, calendar]);

  if (!calendar) return null;

  const allSelected = own.length > 0 && selected.size === own.length;
  const toggle = (id: string) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  const apply = (fate: Fate) => {
    animateNextLayout();
    setFates((prev) => ({ ...prev, ...Object.fromEntries([...selected].map((id) => [id, fate])) }));
    setSelected(new Set());
  };

  const moving = own.filter((e) => fates[e.id]).length;
  const deleting = own.length - moving;
  const summary = [
    ...others
      .map((c) => ({ c, n: own.filter((e) => fates[e.id] === c.id).length }))
      .filter((x) => x.n > 0)
      .map((x) => `${x.n} to ${x.c.name}`),
    deleting ? `${deleting} deleted` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const confirm = async () => {
    const body = own.length
      ? `${moving ? `${moving} event${moving === 1 ? '' : 's'} will move. ` : ''}${
          deleting ? `${deleting} event${deleting === 1 ? '' : 's'} will be permanently deleted.` : ''
        }`
      : 'This calendar has no events.';
    if (!(await confirmAsync(`Delete “${calendar.name}”?`, body.trim(), 'Delete', true))) return;
    deleteCalendarWithPlan(calendar.id, fates, target || others[0]?.id || null);
    navigation.popToTop();
    navigation.navigate('Calendars');
  };

  const header = (
    <View style={styles.header}>
      <View style={styles.hero}>
        <ColorDot color={calendar.color} size={14} />
        <Text style={styles.heroTitle}>{calendar.name}</Text>
        <Text style={styles.heroMeta}>
          {own.length} event{own.length === 1 ? '' : 's'}
        </Text>
      </View>
      {own.length > 0 ? (
        <>
          <Text style={styles.help}>Choose what happens to each event. Select events, then move or delete them together.</Text>
          <View style={styles.bulk}>
            <Pressable
              onPress={() => setSelected(allSelected ? new Set() : new Set(own.map((e) => e.id)))}
              style={styles.selectAll}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: allSelected }}
            >
              <View style={[styles.checkbox, allSelected && styles.checkboxOn, selected.size > 0 && !allSelected && styles.checkboxPartial]}>
                {allSelected ? <Icon name="check" size={13} color={colors.onPrimary} strokeWidth={3} /> : null}
                {selected.size > 0 && !allSelected ? <Icon name="minus" size={13} color={colors.onPrimary} strokeWidth={3} /> : null}
              </View>
              <Text style={styles.selectAllText}>{selected.size ? `${selected.size} selected` : 'Select all'}</Text>
            </Pressable>
          </View>
          <View style={[styles.actions, selected.size === 0 && styles.actionsIdle]} pointerEvents={selected.size ? 'auto' : 'none'}>
            <Text style={styles.actionsLabel}>Move to</Text>
            <View style={styles.chips}>
              {others.map((c) => (
                <Chip key={c.id} label={c.name} color={c.color} selected={target === c.id} onPress={() => setTarget(c.id)} />
              ))}
            </View>
            <View style={styles.actionButtons}>
              <Button small title="Move selected" onPress={() => apply(target)} style={styles.flex} />
              <Button small variant="danger" title="Delete selected" onPress={() => apply(null)} style={styles.flex} />
            </View>
          </View>
        </>
      ) : null}
    </View>
  );

  return (
    <View style={styles.screen}>
      <FlatList
        data={own}
        keyExtractor={(e) => e.id}
        ListHeaderComponent={header}
        ListEmptyComponent={<EmptyState icon="calendar" title="No events here" subtitle="Deleting this calendar won’t remove anything else." />}
        contentContainerStyle={styles.list}
        renderItem={({ item: e }) => {
          const fate = fates[e.id] ?? null;
          const dest = fate ? calendarsById[fate] : undefined;
          const checked = selected.has(e.id);
          const start = parseTimestamp(e.startDate);
          const next = e.recurrenceRule ? nextOccurrence(e, calendar, new Date()) : null;
          return (
            <Pressable
              onPress={() => toggle(e.id)}
              style={({ pressed }) => [styles.row, checked && styles.rowChecked, pressed && styles.pressed]}
              accessibilityRole="checkbox"
              accessibilityState={{ checked }}
            >
              <View style={[styles.checkbox, checked && styles.checkboxOn]}>
                {checked ? <Icon name="check" size={13} color={colors.onPrimary} strokeWidth={3} /> : null}
              </View>
              <View style={styles.flex}>
                <View style={styles.titleRow}>
                  {eventIconKey(e.emoji) ? <EventGlyph value={e.emoji} size={14} color={colors.textMuted} /> : null}
                  <Text style={styles.title} numberOfLines={1}>
                    {eventLabel(e)}
                  </Text>
                </View>
                <Text style={styles.meta} numberOfLines={1}>
                  {e.recurrenceRule
                    ? `${describeRRule(e.recurrenceRule, start)}${next ? ` · next ${formatRange(next.start, next.end, e.isAllDay)}` : ''}`
                    : formatRange(start, parseTimestamp(e.endDate), e.isAllDay)}
                </Text>
              </View>
              <View style={[styles.fate, !dest && styles.fateDelete]}>
                {dest ? <ColorDot color={dest.color} size={8} /> : <Icon name="x" size={12} color={colors.danger} strokeWidth={2.5} />}
                <Text style={[styles.fateText, !dest && styles.fateTextDelete]} numberOfLines={1}>
                  {dest ? dest.name : 'Delete'}
                </Text>
              </View>
            </Pressable>
          );
        }}
      />
      <View style={styles.footer}>
        {own.length ? <Text style={styles.summary}>{summary}</Text> : null}
        <Button variant="danger" title="Delete calendar" onPress={() => void confirm()} />
      </View>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  list: { padding: spacing.lg, gap: 8, paddingBottom: 24 },
  header: { gap: spacing.md, marginBottom: spacing.sm },
  hero: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  heroTitle: { fontFamily: fonts.display, fontSize: 26, color: colors.text, flexShrink: 1 },
  heroMeta: { fontSize: 14, color: colors.textMuted, marginLeft: 'auto' },
  help: { fontSize: 14, color: colors.textMuted, lineHeight: 20 },
  bulk: { flexDirection: 'row', alignItems: 'center' },
  selectAll: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
  selectAllText: { fontSize: 15, fontWeight: '600', color: colors.text },
  actions: {
    gap: 10,
    padding: spacing.md,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionsIdle: { opacity: 0.45 },
  actionsLabel: { fontSize: 11, fontWeight: '700', letterSpacing: 1.4, color: colors.textMuted },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  actionButtons: { flexDirection: 'row', gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  rowChecked: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  pressed: { opacity: 0.8 },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.textFaint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxOn: { backgroundColor: colors.primary, borderColor: colors.primary },
  checkboxPartial: { backgroundColor: colors.primary, borderColor: colors.primary },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { flexShrink: 1, fontSize: 15, fontWeight: '600', color: colors.text },
  meta: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  fate: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceAlt,
    maxWidth: 110,
  },
  fateDelete: { backgroundColor: colors.dangerSoft },
  fateText: { fontSize: 12, fontWeight: '700', color: colors.text },
  fateTextDelete: { color: colors.danger },
  footer: {
    padding: spacing.lg,
    gap: 8,
    borderTopWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  summary: { fontSize: 13, color: colors.textMuted, textAlign: 'center' },
}));
