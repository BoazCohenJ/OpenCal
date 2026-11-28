import { addYears, endOfDay, startOfDay } from 'date-fns';
import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { OptionalDateButton } from '../components/DateTimeField';
import { Button, Chip, ColorDot, EmptyState, HeaderButton } from '../components/ui';
import { useCalendarContext } from '../context/CalendarContext';
import type { Event } from '../models/Event';
import type { ScreenProps } from '../navigation/types';
import { shareICS } from '../services/exports';
import { expandEvent, isPausedOn, nextOccurrence, type Occurrence } from '../services/occurrences';
import { createStyles, radius, spacing, useTheme } from '../theme';
import { formatRange, parseTimestamp } from '../utils/dates';
import { eventLabel } from '../utils/format';
import { EventGlyph, eventIconKey, Icon } from '../components/Icon';
import { animateNextLayout } from '../utils/motion';
import { describeRRule } from '../utils/recurrence';

interface RowData {
  event: Event;
  next: Occurrence | null;
}

/** "Hidden" events list under Settings: a flat, filterable list of every event (not a grid). */
export function HiddenEventsListScreen({ navigation, route }: ScreenProps<'HiddenEvents'>) {
  const searching = route.params?.search === true;
  const styles = useStyles();
  const { colors } = useTheme();
  const { events, calendars, calendarsById, allTags, getEffectiveColor, notificationPrefs } = useCalendarContext();
  const [search, setSearch] = useState('');
  const [searchFocused, setSearchFocused] = useState(searching);
  const [repeatingOnly, setRepeatingOnly] = useState(false);
  const [calendarId, setCalendarId] = useState<string | null>(null);
  const [tag, setTag] = useState<string | null>(null);
  const [from, setFrom] = useState<Date | null>(null);
  const [to, setTo] = useState<Date | null>(null);
  const [showMoreFilters, setShowMoreFilters] = useState(!searching);

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
        return parseTimestamp(b.event.startDate).getTime() - parseTimestamp(a.event.startDate).getTime();
      });
  }, [events, calendarsById, search, repeatingOnly, calendarId, tag, from, to]);

  // Exports exactly the events the filters show.
  const exportShown = () => {
    const only = calendarId ? calendarsById[calendarId] : undefined;
    void shareICS(only?.name ?? 'OpenCal events', rows.map((r) => r.event), calendarsById, notificationPrefs.allDayTime, only?.color);
  };
  const exportRef = useRef(exportShown);
  useLayoutEffect(() => {
    exportRef.current = exportShown;
  });
  const hasRows = rows.length > 0;
  useLayoutEffect(() => {
    navigation.setOptions({
      ...(searching ? { title: 'Search' } : {}),
      headerRight: () => (hasRows ? <HeaderButton title="Export" onPress={() => exportRef.current()} /> : null),
    });
  }, [navigation, hasRows, searching]);

  const advancedCount = [tag, from, to].filter(Boolean).length;
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
        <View style={[styles.searchBox, searchFocused && styles.searchBoxFocused]}>
          <Icon name="search" size={17} color={searchFocused ? colors.primary : colors.textFaint} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            onFocus={() => setSearchFocused(true)}
            onBlur={() => setSearchFocused(false)}
            placeholder="Search title, place, notes, tags…"
            placeholderTextColor={colors.textFaint}
            style={styles.searchInput}
            autoFocus={searching}
            returnKeyType="search"
          />
          {search.length > 0 ? (
            <Pressable
              onPress={() => setSearch('')}
              hitSlop={10}
              accessibilityLabel="Clear search"
              style={({ pressed }) => [styles.searchClear, pressed && { opacity: 0.7 }]}
            >
              <Icon name="x" size={14} color={colors.textMuted} />
            </Pressable>
          ) : null}
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          {searching ? (
            <Chip
              label={advancedCount ? `Filters · ${advancedCount}` : 'Filters'}
              selected={showMoreFilters || advancedCount > 0}
              onPress={() => {
                animateNextLayout();
                setShowMoreFilters((v) => !v);
              }}
            />
          ) : null}
          <Chip label="Repeating" selected={repeatingOnly} onPress={() => setRepeatingOnly((v) => !v)} />
          <Chip label="All calendars" selected={calendarId === null} onPress={() => setCalendarId(null)} />
          {calendars.map((c) => (
            <Chip key={c.id} label={c.name} color={c.color} selected={calendarId === c.id} onPress={() => setCalendarId(calendarId === c.id ? null : c.id)} />
          ))}
        </ScrollView>
        {showMoreFilters ? (
          <>
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
          </>
        ) : null}
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
            icon="search"
            title={events.length === 0 ? 'No events yet' : 'No events match these filters'}
          >
            {events.length > 0 && activeFilters > 0 ? (
              <Button small variant="secondary" title="Clear filters" onPress={clearAll} style={styles.emptyAction} />
            ) : null}
          </EmptyState>
        }
        renderItem={({ item }) => {
          const e = item.event;
          const cal = calendarsById[e.calendarId];
          const start = parseTimestamp(e.startDate);
          const end = parseTimestamp(e.endDate);
          const paused = isPausedOn(e, cal, new Date());
          const effectiveColor = getEffectiveColor(e);
          return (
            <Pressable
              onPress={() => navigation.navigate('EventEdit', { eventId: e.id })}
              style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
                styles.item,
                { borderLeftColor: effectiveColor },
                hovered && styles.itemHover,
                pressed && { opacity: 0.85 },
              ]}
            >
              <View style={styles.itemTop}>
                {eventIconKey(e.emoji) ? <EventGlyph value={e.emoji} size={16} color={effectiveColor} /> : null}
                <Text style={styles.itemTitle} numberOfLines={1}>
                  {eventLabel(e)}
                </Text>
                {e.recurrenceRule ? (
                  <View style={styles.badge}>
                    <Icon name="repeat" size={12} color={colors.textMuted} />
                  </View>
                ) : null}
                {paused ? (
                  <View style={[styles.badge, styles.pausedBadge]}>
                    <Icon name="pause" size={11} color={colors.primary} />
                    <Text style={styles.pausedText}>Paused</Text>
                  </View>
                ) : null}
              </View>
              <View style={styles.itemMetaRow}>
                {cal ? <ColorDot color={cal.color} size={8} /> : null}
                <Text style={styles.itemMeta} numberOfLines={1}>
                  {cal?.name ?? 'No calendar'} · {e.recurrenceRule ? describeRRule(e.recurrenceRule, start) : formatRange(start, end, e.isAllDay)}
                </Text>
              </View>
              <Text style={styles.itemNext} numberOfLines={1}>
                {item.next ? `Next: ${formatRange(item.next.start, item.next.end, e.isAllDay)}` : 'Past'}
                {e.location ? `  ·  ${e.location}` : ''}
              </Text>
              {e.tags.length ? <Text style={styles.tags}>{e.tags.map((t) => `#${t}`).join('  ')}</Text> : null}
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.bg },
  filters: { paddingHorizontal: spacing.lg, paddingTop: spacing.md, gap: 8, paddingBottom: 4 },
  searchBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    minHeight: 44,
  },
  searchBoxFocused: { borderColor: colors.primary },
  searchInput: { flex: 1, fontSize: 16, color: colors.text, paddingVertical: 9 },
  searchClear: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipRow: { gap: 8 },
  dateRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 4 },
  summary: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  clear: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  emptyAction: { marginTop: spacing.sm },
  list: { padding: spacing.lg, gap: 10, paddingBottom: 48 },
  item: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderLeftWidth: 5,
    padding: 14,
    gap: 4,
  },
  itemHover: { backgroundColor: colors.surfaceAlt },
  itemTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  itemTitle: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.text },
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.surfaceAlt, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 6 },
  pausedBadge: { backgroundColor: colors.primarySoft },
  pausedText: { fontSize: 12, color: colors.primary, fontWeight: '600' },
  itemMetaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  itemMeta: { flex: 1, fontSize: 13, color: colors.textMuted },
  itemNext: { fontSize: 13, color: colors.text },
  tags: { fontSize: 12, color: colors.primary, marginTop: 2 },
}));
