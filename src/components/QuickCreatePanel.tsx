import { differenceInMinutes, format } from 'date-fns';
import React, { useEffect, useState } from 'react';
import { Pressable, PressableStateCallbackType, StyleSheet, Text, TextInput, useWindowDimensions, View, type ViewStyle } from 'react-native';
import type { Calendar } from '../models/Calendar';
import { createStyles, fonts, radius, shadow, spacing, useTheme } from '../theme';
import { formatTime } from '../utils/dates';
import { formatDuration } from '../utils/format';
import { Icon, type IconName } from './Icon';
import { CalendarSelector } from './Selectors';
import { Button } from './ui';

type Hover = PressableStateCallbackType & { hovered?: boolean };

const PANEL_WIDTH = 400;
const GAP = 16;

export interface QuickCreateValues {
  title: string;
  location: string;
  calendarId: string;
}

/**
 * Desktop quick-create panel shown beside a new-event pill: title, the time (changed by dragging
 * the pill, which stays live behind it), location and calendar. Save adds the event; More options
 * opens the full editor with what was typed. Enter saves, Escape closes.
 *
 * It floats over the calendar without a backdrop so the pill can still be dragged.
 */
export function QuickCreatePanel({
  start,
  end,
  values,
  calendars,
  anchor,
  onChange,
  onSave,
  onMoreOptions,
  onClose,
}: {
  start: Date;
  end: Date;
  values: QuickCreateValues;
  calendars: Calendar[];
  /** Window point that was clicked; the panel opens beside it. */
  anchor: { x: number; y: number };
  onChange: (patch: Partial<QuickCreateValues>) => void;
  onSave: () => void;
  onMoreOptions: () => void;
  onClose: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const window = useWindowDimensions();
  const [height, setHeight] = useState(340);
  const [titleFocused, setTitleFocused] = useState(true);
  const canSave = values.title.trim().length > 0;

  useEffect(() => {
    if (typeof document === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Beside the click, on whichever side has room, and never past the window edges.
  const right = anchor.x + GAP;
  const left = right + PANEL_WIDTH <= window.width - GAP ? right : Math.max(GAP, anchor.x - GAP - PANEL_WIDTH);
  const top = Math.max(GAP, Math.min(anchor.y - 90, window.height - height - GAP));
  const submit = () => {
    if (canSave) onSave();
  };

  return (
    <View
      // Fixed to the window (React Native Web passes it through); the panel only exists on desktop.
      style={[styles.panel, { position: 'fixed', left, top } as unknown as ViewStyle]}
      onLayout={(e) => setHeight(e.nativeEvent.layout.height)}
      accessibilityRole="none"
      accessibilityLabel="New event"
    >
      <View style={styles.topRow}>
        <Pressable onPress={onClose} style={({ hovered }: Hover) => [styles.close, hovered && styles.hover]} accessibilityLabel="Close">
          <Icon name="x" size={18} color={colors.textMuted} />
        </Pressable>
      </View>
      <View style={styles.titleRow}>
        <TextInput
          autoFocus
          value={values.title}
          onChangeText={(title) => onChange({ title })}
          onSubmitEditing={submit}
          onFocus={() => setTitleFocused(true)}
          onBlur={() => setTitleFocused(false)}
          placeholder="Add title"
          placeholderTextColor={colors.textFaint}
          style={[styles.title, titleFocused && styles.titleFocused]}
          accessibilityLabel="Title"
        />
      </View>
      <PanelRow icon="clock">
        <Text style={styles.rowText}>
          {format(start, 'EEEE, MMMM d')}
          <Text style={styles.rowTextStrong}>{`   ${formatTime(start)} – ${formatTime(end)}`}</Text>
        </Text>
        <Text style={styles.rowSub}>{formatDuration(differenceInMinutes(end, start))} · drag the event to change it</Text>
      </PanelRow>
      <PanelRow icon="map-pin">
        <TextInput
          value={values.location}
          onChangeText={(location) => onChange({ location })}
          onSubmitEditing={submit}
          placeholder="Add location"
          placeholderTextColor={colors.textFaint}
          style={styles.inlineInput}
          accessibilityLabel="Location"
        />
      </PanelRow>
      {calendars.length > 1 ? (
        <PanelRow icon="calendar" center>
          <CalendarSelector calendars={calendars} value={values.calendarId} onChange={(calendarId) => onChange({ calendarId })} />
        </PanelRow>
      ) : null}
      <View style={styles.footer}>
        <Button variant="ghost" small title="More options" onPress={onMoreOptions} />
        <Button small title="Save" onPress={submit} disabled={!canSave} style={styles.save} />
      </View>
    </View>
  );
}

function PanelRow({ icon, center = false, children }: { icon: IconName; center?: boolean; children: React.ReactNode }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={[styles.row, center && styles.rowCenter]}>
      <View style={[styles.rowIcon, center && styles.rowIconCenter]}>
        <Icon name={icon} size={18} color={colors.textMuted} />
      </View>
      <View style={styles.rowBody}>{children}</View>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  panel: {
    width: PANEL_WIDTH,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    zIndex: 100,
    ...shadow,
    shadowColor: colors.shadow,
    shadowOpacity: 0.3,
    shadowRadius: 24,
  },
  topRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  close: { width: 32, height: 32, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  hover: { backgroundColor: colors.surfaceAlt },
  titleRow: { paddingLeft: 38, marginBottom: spacing.md },
  title: {
    fontFamily: fonts.display,
    fontSize: 22,
    color: colors.text,
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    outlineWidth: 0,
  },
  titleFocused: { borderBottomWidth: 2, borderBottomColor: colors.primary },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, paddingVertical: 8 },
  rowIcon: { width: 26, alignItems: 'center', paddingTop: 2 },
  rowBody: { flex: 1, minWidth: 0 },
  rowCenter: { alignItems: 'center' },
  rowIconCenter: { paddingTop: 0 },
  rowText: { fontSize: 15, color: colors.text },
  rowTextStrong: { fontWeight: '600' },
  rowSub: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
  inlineInput: { fontSize: 15, color: colors.text, paddingVertical: 2, outlineWidth: 0 },
  footer: { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md },
  save: { paddingHorizontal: spacing.xl },
}));
