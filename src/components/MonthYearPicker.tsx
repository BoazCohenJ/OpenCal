import { format } from 'date-fns';
import React, { useEffect, useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, PressableStateCallbackType, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { createStyles, fonts, radius, shadow, spacing, useTheme } from '../theme';
import { useDesktop } from '../utils/desktop';
import { Icon } from './Icon';
import { Sheet } from './Sheet';

const MONTHS = Array.from({ length: 12 }, (_, i) => i);
const MONTH_LABELS = MONTHS.map((m) => format(new Date(2000, m, 1), 'MMM'));
const CELL_HEIGHT = 44;
const GAP = 8;
const YEAR_LABEL_HEIGHT = 46;
const YEAR_PADDING = 22;
/** Every year block has the same height, so the list can snap year by year and jump straight to one. */
const YEAR_HEIGHT = YEAR_LABEL_HEIGHT + 3 * CELL_HEIGHT + 2 * GAP + YEAR_PADDING;

/**
 * A vertical list of years, each with a 4×3 grid of months. Scroll up or down to move between
 * years (it snaps to one year at a time); tap a month to pick it.
 */
export function MonthYearGrid({
  value,
  onSelect,
  minYear,
  maxYear,
  max,
  showSelection = true,
}: {
  /** The month shown as selected; the list opens on its year. */
  value: Date;
  /** False to only use `value` to pick the year the list opens on. */
  showSelection?: boolean;
  onSelect: (month: Date) => void;
  minYear: number;
  maxYear: number;
  /** Months after this one are disabled. */
  max?: Date;
}) {
  const styles = useStyles();
  const years = useMemo(() => Array.from({ length: maxYear - minYear + 1 }, (_, i) => minYear + i), [minYear, maxYear]);
  const now = new Date();
  const selectedYear = Math.min(maxYear, Math.max(minYear, value.getFullYear()));
  const maxKey = max ? max.getFullYear() * 12 + max.getMonth() : Infinity;

  return (
    <FlatList
      style={styles.list}
      data={years}
      keyExtractor={String}
      initialScrollIndex={selectedYear - minYear}
      getItemLayout={(_, index) => ({ length: YEAR_HEIGHT, offset: YEAR_HEIGHT * index, index })}
      snapToInterval={YEAR_HEIGHT}
      decelerationRate="fast"
      showsVerticalScrollIndicator={false}
      initialNumToRender={3}
      windowSize={5}
      renderItem={({ item: year }) => (
        <View style={styles.year}>
          <Text style={[styles.yearLabel, year === now.getFullYear() && styles.yearLabelCurrent]}>{year}</Text>
          <View style={styles.grid}>
            {MONTHS.map((m) => {
              const selected = showSelection && year === value.getFullYear() && m === value.getMonth();
              const current = year === now.getFullYear() && m === now.getMonth();
              const disabled = year * 12 + m > maxKey;
              return (
                <Pressable
                  key={m}
                  disabled={disabled}
                  onPress={() => onSelect(new Date(year, m, 1))}
                  accessibilityRole="button"
                  accessibilityState={{ selected, disabled }}
                  accessibilityLabel={format(new Date(year, m, 1), 'MMMM yyyy')}
                  style={({ pressed }) => [
                    styles.cell,
                    current && styles.cellCurrent,
                    selected && styles.cellSelected,
                    disabled && styles.cellDisabled,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={[styles.cellText, current && styles.cellTextCurrent, selected && styles.cellTextSelected]}>
                    {MONTH_LABELS[m]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      )}
    />
  );
}

/**
 * Bottom sheet for jumping to any month. "Today" goes back to the current month. On desktop it is
 * a dropdown under `anchor` instead (see MonthYearMenu).
 */
export function MonthYearSheet({
  visible,
  onClose,
  value,
  onSelect,
  anchor,
}: {
  visible: boolean;
  onClose: () => void;
  value: Date;
  onSelect: (month: Date) => void;
  /** Window position of the dropdown's top-left corner on desktop. */
  anchor?: { x: number; y: number } | null;
}) {
  const desktop = useDesktop();
  const thisYear = new Date().getFullYear();
  if (desktop) return <MonthYearMenu visible={visible} onClose={onClose} value={value} onSelect={onSelect} anchor={anchor} />;
  return (
    <Sheet visible={visible} onClose={onClose} title="Go to month" actionLabel="Today" onAction={() => onSelect(new Date())}>
      <MonthYearGrid value={value} onSelect={onSelect} minYear={thisYear - 100} maxYear={thisYear + 50} />
    </Sheet>
  );
}

type Hover = PressableStateCallbackType & { hovered?: boolean };

/**
 * Desktop dropdown: one year at a time with arrows to step it, and a compact month grid. ← → (or
 * Page Up/Down) step the year, Escape closes.
 */
function MonthYearMenu({
  visible,
  onClose,
  value,
  onSelect,
  anchor,
}: {
  visible: boolean;
  onClose: () => void;
  value: Date;
  onSelect: (month: Date) => void;
  anchor?: { x: number; y: number } | null;
}) {
  const styles = useMenuStyles();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const [year, setYear] = useState(value.getFullYear());
  // Reopening starts on the shown month's year again.
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) setYear(value.getFullYear());
  }

  useEffect(() => {
    if (!visible || typeof document === 'undefined') return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') setYear((y) => y - 1);
      else if (e.key === 'ArrowRight' || e.key === 'PageDown') setYear((y) => y + 1);
      else return;
      e.preventDefault();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [visible, onClose]);

  const now = new Date();
  const left = Math.max(spacing.lg, Math.min(anchor?.x ?? spacing.lg, width - MENU_WIDTH - spacing.lg));
  const top = anchor?.y ?? 64;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Close" />
      <View style={[styles.menu, { left, top }]} accessibilityRole="menu">
        <View style={styles.header}>
          <Pressable onPress={() => setYear(year - 1)} style={({ hovered }: Hover) => [styles.arrow, hovered && styles.hover]} accessibilityLabel="Previous year">
            <Icon name="chevron-left" size={18} color={colors.textMuted} strokeWidth={2.5} />
          </Pressable>
          <Text style={[styles.year, year === now.getFullYear() && styles.yearCurrent]}>{year}</Text>
          <Pressable onPress={() => setYear(year + 1)} style={({ hovered }: Hover) => [styles.arrow, hovered && styles.hover]} accessibilityLabel="Next year">
            <Icon name="chevron-right" size={18} color={colors.textMuted} strokeWidth={2.5} />
          </Pressable>
        </View>
        <View style={styles.grid}>
          {MONTHS.map((m) => {
            const selected = year === value.getFullYear() && m === value.getMonth();
            const current = year === now.getFullYear() && m === now.getMonth();
            return (
              <Pressable
                key={m}
                onPress={() => onSelect(new Date(year, m, 1))}
                accessibilityRole="menuitem"
                accessibilityState={{ selected }}
                accessibilityLabel={format(new Date(year, m, 1), 'MMMM yyyy')}
                style={({ hovered }: Hover) => [styles.cell, hovered && !selected && styles.hover, selected && styles.cellSelected]}
              >
                <Text style={[styles.cellText, current && styles.cellTextCurrent, selected && styles.cellTextSelected]}>{MONTH_LABELS[m]}</Text>
              </Pressable>
            );
          })}
        </View>
        <Pressable onPress={() => onSelect(new Date())} style={({ hovered }: Hover) => [styles.today, hovered && styles.hover]}>
          <Text style={styles.todayText}>Today</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const MENU_WIDTH = 300;

const useMenuStyles = createStyles((colors) => ({
  menu: {
    position: 'absolute',
    width: MENU_WIDTH,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...shadow,
    shadowColor: colors.shadow,
    shadowOpacity: 0.25,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  arrow: { width: 32, height: 32, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  year: { fontFamily: fonts.displayBold, fontSize: 20, color: colors.text, letterSpacing: -0.4 },
  yearCurrent: { color: colors.primary },
  hover: { backgroundColor: colors.surfaceAlt },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: spacing.xs },
  cell: { width: '33.333%', height: 38, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  cellSelected: { backgroundColor: colors.primary },
  cellText: { fontSize: 14, fontWeight: '600', color: colors.text },
  cellTextCurrent: { color: colors.primary, fontWeight: '800' },
  cellTextSelected: { color: colors.onPrimary, fontWeight: '800' },
  today: {
    marginTop: spacing.sm,
    paddingTop: spacing.sm,
    height: 40,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.hairline,
  },
  todayText: { fontSize: 14, fontWeight: '600', color: colors.primary },
}));

const useStyles = createStyles((colors) => ({
  // A year and a peek of the next, so it's clear the list scrolls.
  list: { height: Math.round(YEAR_HEIGHT * 1.3), flexGrow: 0 },
  year: { height: YEAR_HEIGHT, paddingBottom: YEAR_PADDING },
  yearLabel: { height: YEAR_LABEL_HEIGHT, fontFamily: fonts.displayBold, fontSize: 30, lineHeight: 38, color: colors.text, letterSpacing: -0.6 },
  yearLabelCurrent: { color: colors.primary },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
  cell: {
    flexBasis: '22%',
    flexGrow: 1,
    height: CELL_HEIGHT,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderStyle: 'solid',
    borderColor: colors.border,
  },
  cellCurrent: { borderColor: colors.primary },
  cellSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  cellDisabled: { opacity: 0.3 },
  cellText: { fontSize: 15, fontWeight: '600', color: colors.text },
  cellTextCurrent: { color: colors.primary },
  cellTextSelected: { color: colors.onPrimary, fontWeight: '800' },
  pressed: { opacity: 0.7 },
}));
