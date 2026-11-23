import { formatDistanceToNow } from 'date-fns';
import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Icon } from '../components/Icon';
import { useToast } from '../components/Toast';
import { Button, EmptyState, HeaderButton } from '../components/ui';
import { useCalendarContext } from '../context/CalendarContext';
import type { ScreenProps } from '../navigation/types';
import { keepChanges, loadInbox, undoChange, UndoConflict, type InboxChange, type InboxItem } from '../services/inbox';
import { getSyncConfig } from '../services/sync';
import { createStyles, radius, spacing, useTheme } from '../theme';
import { confirmAsync, notify } from '../utils/confirm';
import { formatRange, parseTimestamp } from '../utils/dates';

/** Items shown per change before "and N more". */
const MAX_ITEMS = 5;

interface Line {
  verb: 'Added' | 'Changed' | 'Deleted';
  text: string;
  /** For a changed event that moved: where it was before. */
  was?: string;
  color?: string;
}

const when = (e: any): string => {
  try {
    return formatRange(parseTimestamp(e.startDate), parseTimestamp(e.endDate), e.isAllDay === true);
  } catch {
    return '';
  }
};

function describeItem(item: InboxItem, calendarOf: (id: string) => { name: string; color: string } | undefined): Line {
  const verb = item.before == null ? 'Added' : item.after == null ? 'Deleted' : 'Changed';
  const record = item.after ?? item.before ?? {};
  switch (item.kind) {
    case 'event': {
      const time = when(record);
      const cal = calendarOf(record.calendarId);
      const moved = verb === 'Changed' && when(item.before) !== time ? when(item.before) : undefined;
      return { verb, text: [record.title || 'Untitled event', time, cal?.name].filter(Boolean).join(' · '), was: moved, color: record.color ?? cal?.color };
    }
    case 'calendar':
      return { verb, text: `Calendar “${record.name ?? item.id}”`, color: record.color };
    case 'template':
      return { verb, text: `Stamp “${record.name ?? item.id}”` };
    default:
      return { verb: 'Changed', text: item.id === 'birthdays' ? 'Birthdays' : `Setting “${item.id}”` };
  }
}

/**
 * What an AI assistant changed in the calendar through the sync server, newest first. Each change
 * can be kept (it leaves the inbox) or undone (the server puts back exactly what it replaced).
 */
export function InboxScreen({ navigation }: ScreenProps<'Inbox'>) {
  const styles = useStyles();
  const { colors } = useTheme();
  const showToast = useToast();
  const { calendarsById } = useCalendarContext();
  const config = getSyncConfig();
  const [changes, setChanges] = useState<InboxChange[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const url = config?.url;
  const apiKey = config?.apiKey;
  const load = useCallback(() => {
    const current = getSyncConfig();
    if (!current) return;
    loadInbox(current)
      .then(
        (list) => {
          setChanges(list);
          setError(null);
        },
        (e: unknown) => setError(e instanceof Error ? e.message : String(e)),
      )
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (url && apiKey) load();
  }, [load, url, apiKey]);

  const pullToRefresh = () => {
    setLoading(true);
    load();
  };

  const drop = (ids: number[]) => setChanges((prev) => prev?.filter((c) => !ids.includes(c.id)) ?? prev);

  const keep = async (ids?: number[]) => {
    if (!config) return;
    try {
      await keepChanges(config, ids);
      if (ids) drop(ids);
      else setChanges([]);
    } catch (e) {
      notify('Couldn’t reach the server', e instanceof Error ? e.message : String(e));
    }
  };

  const undo = async (change: InboxChange, force = false) => {
    if (!config) return;
    setBusyId(change.id);
    try {
      await undoChange(config, change.id, force);
      drop([change.id]);
      showToast({ icon: 'check', message: 'Undone' });
    } catch (e) {
      if (e instanceof UndoConflict && !force) {
        const ok = await confirmAsync(
          'Edited since',
          'Something in this change was edited again after the assistant made it. Undoing puts back the version from before the assistant, and those later edits are lost.',
          'Undo anyway',
          true,
        );
        if (ok) {
          setBusyId(null);
          return undo(change, true);
        }
      } else {
        notify('Couldn’t undo', e instanceof Error ? e.message : String(e));
      }
    } finally {
      setBusyId(null);
    }
  };

  const keepAllRef = useRef(keep);
  useLayoutEffect(() => {
    keepAllRef.current = keep;
  });
  const hasChanges = !!changes?.length;
  useLayoutEffect(() => {
    navigation.setOptions({ headerRight: () => (hasChanges ? <HeaderButton title="Keep all" onPress={() => void keepAllRef.current()} /> : null) });
  }, [navigation, hasChanges]);

  if (!config) {
    return (
      <View style={styles.screen}>
        <EmptyState
          icon="sparkles"
          title="No server connected"
          subtitle="When an assistant changes your calendar through your OpenCal server, the changes show up here to keep or undo."
        >
          <Button title="Set up sync" onPress={() => navigation.navigate('Sync')} style={styles.emptyButton} />
        </EmptyState>
      </View>
    );
  }

  if (changes === null) {
    return (
      <View style={[styles.screen, styles.center]}>
        {error ? (
          <EmptyState icon="sparkles" title="Couldn’t load the inbox" subtitle={error}>
            <Button title="Try again" onPress={load} style={styles.emptyButton} />
          </EmptyState>
        ) : (
          <ActivityIndicator color={colors.primary} />
        )}
      </View>
    );
  }

  const calendarOf = (id: string) => calendarsById[id];

  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={styles.list}
      data={changes}
      keyExtractor={(c) => String(c.id)}
      refreshControl={<RefreshControl refreshing={loading} onRefresh={pullToRefresh} />}
      ListHeaderComponent={error ? <Text style={styles.error}>{error}</Text> : null}
      ListEmptyComponent={
        <EmptyState
          icon="check"
          title="All caught up"
          subtitle="Changes an assistant makes through your server show up here, so you can keep or undo each one."
        />
      }
      renderItem={({ item: change }) => {
        const lines = change.items.map((i) => describeItem(i, calendarOf));
        const busy = busyId === change.id;
        return (
          <View style={styles.card}>
            <View style={styles.cardTop}>
              <Icon name="sparkles" size={15} color={colors.primary} />
              <Text style={styles.ago}>{formatDistanceToNow(change.at, { addSuffix: true })}</Text>
            </View>
            <Text style={styles.summary}>{change.summary}</Text>
            <View style={styles.lines}>
              {lines.slice(0, MAX_ITEMS).map((l, i) => (
                <View key={i} style={styles.line}>
                  <View style={[styles.lineDot, { backgroundColor: l.color ?? colors.textFaint }]} />
                  <View style={styles.flex}>
                    <Text style={styles.lineText} numberOfLines={2}>
                      <Text style={[styles.verb, l.verb === 'Deleted' && { color: colors.danger }]}>{l.verb} </Text>
                      {l.text}
                    </Text>
                    {l.was ? <Text style={styles.was}>was {l.was}</Text> : null}
                  </View>
                </View>
              ))}
              {lines.length > MAX_ITEMS ? <Text style={styles.more}>and {lines.length - MAX_ITEMS} more</Text> : null}
            </View>
            {change.undoneBy ? (
              <View style={styles.actions}>
                <Text style={styles.undone}>Already undone</Text>
                <Button small variant="ghost" title="Dismiss" onPress={() => void keep([change.id])} />
              </View>
            ) : (
              <View style={styles.actions}>
                <Button small variant="secondary" title={busy ? 'Undoing…' : 'Undo'} disabled={busy} onPress={() => void undo(change)} />
                <Button small title="Keep" disabled={busy} onPress={() => void keep([change.id])} />
              </View>
            )}
          </View>
        );
      }}
    />
  );
}

const useStyles = createStyles((colors) => ({
  screen: { flex: 1, backgroundColor: colors.bg },
  center: { justifyContent: 'center', alignItems: 'center' },
  flex: { flex: 1 },
  list: { padding: spacing.lg, gap: 12, paddingBottom: 48, flexGrow: 1 },
  emptyButton: { marginTop: spacing.lg },
  error: { fontSize: 13, color: colors.danger, paddingBottom: spacing.sm },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    padding: 14,
    gap: 8,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  ago: { fontSize: 12, color: colors.textMuted, fontWeight: '600' },
  summary: { fontSize: 15, fontWeight: '700', color: colors.text },
  lines: { gap: 6 },
  line: { flexDirection: 'row', gap: 8, alignItems: 'flex-start' },
  lineDot: { width: 8, height: 8, borderRadius: 4, marginTop: 6 },
  lineText: { fontSize: 14, color: colors.text, lineHeight: 20 },
  verb: { fontWeight: '700', color: colors.textMuted },
  was: { fontSize: 12, color: colors.textMuted },
  more: { fontSize: 13, color: colors.textMuted, paddingLeft: 16 },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 8, paddingTop: 4 },
  undone: { flex: 1, fontSize: 13, color: colors.textMuted },
}));
