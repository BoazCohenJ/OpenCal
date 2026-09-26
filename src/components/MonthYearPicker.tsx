import { format } from 'date-fns';
import React, { useMemo } from 'react';
import { FlatList, Pressable, Text, View } from 'react-native';
import { createStyles, fonts, radius } from '../theme';
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

/** Bottom sheet for jumping to any month. "Today" goes back to the current month. */
export function MonthYearSheet({
  visible,
  onClose,
  value,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  value: Date;
  onSelect: (month: Date) => void;
}) {
  const thisYear = new Date().getFullYear();
  return (
    <Sheet visible={visible} onClose={onClose} title="Go to month" actionLabel="Today" onAction={() => onSelect(new Date())}>
      <MonthYearGrid value={value} onSelect={onSelect} minYear={thisYear - 100} maxYear={thisYear + 50} />
    </Sheet>
  );
}

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
