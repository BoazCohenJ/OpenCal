import { format } from 'date-fns';
import React from 'react';
import { Text, View } from 'react-native';
import type { Event } from '../models/Event';
import { createStyles, fonts, radius } from '../theme';
import { deepText, softBg } from '../utils/color';
import { parseTimestamp } from '../utils/dates';
import { describeRRule } from '../utils/recurrence';
import { EventGlyph } from './Icon';
import { Sheet } from './Sheet';
import { Button } from './ui';

export type RepeatDeleteChoice = 'this' | 'following' | 'all' | 'keep';

/**
 * Asks what to delete for one repeating event in a bulk delete: only the picked occurrence, it and
 * everything after, or the whole series. "Keep" skips this event; Cancel (or closing) stops the
 * whole delete. `position`/`total` show progress when several repeating events are selected.
 */
export function RepeatDeleteSheet({
  item,
  color,
  position,
  total,
  onChoose,
  onCancel,
}: {
  item: { event: Event; day: Date } | null;
  color: string;
  position: number;
  total: number;
  onChoose: (choice: RepeatDeleteChoice) => void;
  onCancel: () => void;
}) {
  const styles = useStyles();
  const event = item?.event;
  return (
    <Sheet
      visible={!!item}
      onClose={onCancel}
      title={total > 1 ? `Repeating event ${position} of ${total}` : 'Repeating event'}
      actionLabel="Cancel"
    >
      {event && item ? (
        <View style={styles.body}>
          <View style={[styles.card, { borderLeftColor: color }]}>
            <View style={[styles.glyph, { backgroundColor: softBg(color) }]}>
              <EventGlyph value={event.emoji} fallback="event" size={20} color={deepText(color)} />
            </View>
            <View style={styles.cardText}>
              <Text style={styles.title} numberOfLines={2}>
                {event.title}
              </Text>
              <Text style={styles.meta}>{describeRRule(event.recurrenceRule, parseTimestamp(event.startDate))}</Text>
              <Text style={styles.meta}>Selected: {format(item.day, 'EEEE, MMM d')}</Text>
            </View>
          </View>
          <Text style={styles.question}>What should be deleted?</Text>
          <Button variant="secondary" title={`Only this event (${format(item.day, 'MMM d')})`} onPress={() => onChoose('this')} />
          <Button variant="secondary" title="This and following events" onPress={() => onChoose('following')} />
          <Button variant="danger" title="All events in the series" onPress={() => onChoose('all')} />
          {total > 1 ? <Button variant="ghost" title="Don't delete this one" onPress={() => onChoose('keep')} /> : null}
        </View>
      ) : null}
    </Sheet>
  );
}

const useStyles = createStyles((colors) => ({
  body: { gap: 10, paddingBottom: 4 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    borderRadius: radius.md,
    borderLeftWidth: 4,
    backgroundColor: colors.bg,
  },
  glyph: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  cardText: { flex: 1, gap: 2 },
  title: { fontSize: 17, fontFamily: fonts.display, color: colors.text },
  meta: { fontSize: 13, color: colors.textMuted },
  question: { fontSize: 13, fontWeight: '700', color: colors.textMuted, letterSpacing: 0.4, marginTop: 4 },
}));
