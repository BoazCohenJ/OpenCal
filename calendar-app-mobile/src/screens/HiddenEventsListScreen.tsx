import { addYears, endOfDay, startOfDay } from 'date-fns';
import React, { useMemo, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { OptionalDateButton } from '../components/DateTimeField';
import { Chip, EmptyState } from '../components/ui';
import { useCalendarContext } from '../context/CalendarContext';
import type { Event } from '../models/Event';
import type { ScreenProps } from '../navigation/types';
import { expandEvent, isPausedOn, nextOccurrence, type Occurrence } from '../services/occurrences';
import { colors, radius, spacing } from '../theme';
import { formatRange } from '../utils/dates';
import { eventLabel } from '../utils/format';
import { describeRRule } from '../utils/recurrence';

interface RowData {
  event: Event;
  next: Occurrence | null;
}

/** "Hidden" events list under Settings: a flat, filterable list of every event (not a grid). */
export function HiddenEventsListScreen({ navigation }: ScreenProps<'HiddenEvents'>) {
  const { events, calendars, calendarsById, allTags, getEffectiveColor } = useCalendarContext();
  const [search, setSearch] = useState('');
  const [repeatingOnly, setRepeatingOnly] = useState(false);
  const [calendarId, setCalendarId] = useState<string | null>(null);
  const [tag, setTag] = useState<string | null>(null);
  const [from, setFrom] = useState<Date | null>(null);
  const [to, setTo] = useState<Date | null>(null);

  const rows = useMemo<RowData[]>(() => {
    const now = new Date();
    const q = search.trim().toLowerCase();
    const rangeStart = from ? startOfDay(from) : to ? addYears(endOfDay(to), -5) : null;
    const rangeEnd = to ? endOfDay(to) : from ? addYears(startOfDay(from), 5) : null;

    return events
      .filter((e) => {
        if (repeatingOnly && !e.recurrenceRule) return false;
        if (calendarId && e.calendarId !== calendarId) return false;
        if (tag && !e.tags.includes(tag)) return false;
        if (q && ![e.title, e.location, e.description, e.emoji, ...e.tags].some((s) => s?.toLowerCase().includes(q))) return false;
        // Date range matches if any (non-paused) occurrence falls inside it.
        if (rangeStart && rangeEnd && expandEvent(e, calendarsById[e.calendarId], rangeStart, rangeEnd).length === 0) return false;
        return true;
      })
      .map((event) => ({ event, next: nextOccurrence(event, calendarsById[event.calendarId], now) }))
      .sort((a, b) => {
        if (a.next && b.next) return a.next.start.getTime() - b.next.start.getTime();
        if (a.next) return -1;
        if (b.next) return 1;
        return new Date(b.event.startDate).getTime() - new Date(a.event.startDate).getTime();
      });
  }, [events, calendarsById, search, repeatingOnly, calendarId, tag, from, to]);

  const activeFilters = [repeatingOnly, calendarId, tag, from, to, search.trim()].filter(Boolean).length;
  const clearAll = () => {
    setSearch('');
    setRepeatingOnly(false);
    setCalendarId(null);
    setTag(null);
    setFrom(null);
    setTo(null);
  };

  return (
    <View style={styles.screen}>
      <View style={styles.filters}>
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search title, place, notes, tags…"
          placeholderTextColor={colors.textFaint}
          style={styles.search}
          clearButtonMode="while-editing"
        />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <Chip label="↻ Repeating only" selected={repeatingOnly} onPress={() => setRepeatingOnly((v) => !v)} />
          <Chip label="All calendars" selected={calendarId === null} onPress={() => setCalendarId(null)} />
          {calendars.map((c) => (
            <Chip key={c.id} label={c.name} color={c.color} selected={calendarId === c.id} onPress={() => setCalendarId(calendarId === c.id ? null : c.id)} />
          ))}
        </ScrollView>
        {allTags.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
            {allTags.map((t) => (
              <Chip key={t} label={`#${t}`} selected={tag === t} onPress={() => setTag(tag === t ? null : t)} />
            ))}
          </ScrollView>
        ) : null}
        <View style={styles.dateRow}>
          <OptionalDateButton label="From" value={from} onChange={setFrom} />
          <OptionalDateButton label="To" value={to} onChange={setTo} />
        </View>
        <View style={styles.summaryRow}>
          <Text style={styles.summary}>
            {rows.length} event{rows.length === 1 ? '' : 's'}
          </Text>
          {activeFilters > 0 ? (
            <Pressable onPress={clearAll} hitSlop={8}>
              <Text style={styles.clear}>Clear filters</Text>
            </Pressable>
          ) : null}
        </View>
      </View>

      <FlatList
        data={rows}
        keyExtractor={(r) => r.event.id}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <EmptyState
            emoji="🔎"
            title={events.length === 0 ? 'No events yet' : 'No events match these filters'}
            subtitle={events.length === 0 ? 'Create one from the calendar screen.' : 'Try removing a filter.'}
          />
        }
        renderItem={({ item }) => {
          const e = item.event;
          const cal = calendarsById[e.calendarId];
          const start = new Date(e.startDate);
          const end = new Date(e.endDate);
          const paused = isPausedOn(e, cal, new Date());
          return (
            <Pressable
              onPress={() => navigation.navigate('EventEdit', { eventId: e.id })}
              style={({ pressed }) => [styles.item, { borderLeftColor: getEffectiveColor(e) }, pressed && { opacity: 0.85 }]}
            >
              <View style={styles.itemTop}>
                <Text style={styles.itemTitle} numberOfLines={1}>
                  {eventLabel(e)}
                </Text>
                {e.recurrenceRule ? <Text style={styles.badge}>↻</Text> : null}
                {paused ? <Text style={[styles.badge, styles.pausedBadge]}>⏸ Paused</Text> : null}
              </View>
              <Text style={styles.itemMeta} numberOfLines={1}>
                {cal?.name ?? 'No calendar'} · {e.recurrenceRule ? describeRRule(e.recurrenceRule, start) : formatRange(start, end, e.isAllDay)}
              </Text>
              <Text style={styles.itemNext} numberOfLines={1}>
                {item.next ? `Next: ${formatRange(item.next.start, item.next.end, e.isAllDay)}` : 'Past'}
                {e.location ? `  ·  📍 ${e.location}` : ''}
              </Text>
              {e.tags.length ? <Text style={styles.tags}>{e.tags.map((t) => `#${t}`).join('  ')}</Text> : null}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  filters: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: 8, paddingBottom: 4 },
  search: { fontSize: 16, color: colors.text, backgroundColor: colors.surface, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 11 },
  chipRow: { gap: 8 },
  dateRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4 },
  summary: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  clear: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  list: { padding: spacing.lg, gap: 10, paddingBottom: 48 },
  item: { backgroundColor: colors.surface, borderRadius: radius.lg, borderLeftWidth: 5, padding: 14, gap: 3 },
  itemTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.text },
  badge: { fontSize: 12, color: colors.textMuted, backgroundColor: colors.surfaceAlt, paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, overflow: 'hidden' },
  pausedBadge: { color: colors.primary, backgroundColor: colors.primarySoft },
  itemMeta: { fontSize: 13, color: colors.textMuted },
  itemNext: { fontSize: 13, color: colors.text },
  tags: { fontSize: 12, color: colors.primary, marginTop: 2 },
});
