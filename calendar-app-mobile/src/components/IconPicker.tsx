import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { createStyles, radius, useTheme } from '../theme';
import { deepText, softBg } from '../utils/color';
import { EVENT_ICONS, EventGlyph, eventIconKey, Icon, toIconValue, type EventIconKey } from './Icon';

const KEYS = Object.keys(EVENT_ICONS) as EventIconKey[];

/** Grid of SVG icons for events and stamps. Stores `icon:<key>` in the `emoji` field. */
export function IconPicker({
  value,
  onChange,
  color: colorProp,
}: {
  value?: string;
  onChange: (value: string | undefined) => void;
  color?: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const color = colorProp ?? colors.primary;
  const selected = eventIconKey(value);
  const legacy = value && !selected ? value : null;
  return (
    <View style={styles.grid}>
      <Pressable
        onPress={() => onChange(undefined)}
        style={[styles.cell, !value && styles.cellActive, !value && { borderColor: color }]}
        accessibilityLabel="No icon"
      >
        <Icon name="x" size={18} color={colors.textFaint} />
      </Pressable>
      {legacy ? (
        <Pressable style={[styles.cell, styles.cellActive, { borderColor: color }]} accessibilityLabel="Current emoji (keep)">
          <Text style={styles.legacy}>{legacy}</Text>
        </Pressable>
      ) : null}
      {KEYS.map((key) => {
        const active = key === selected;
        return (
          <Pressable
            key={key}
            onPress={() => onChange(toIconValue(key))}
            accessibilityLabel={`Icon ${key}`}
            accessibilityState={{ selected: active }}
            style={({ pressed }) => [
              styles.cell,
              active && [styles.cellActive, { backgroundColor: softBg(color), borderColor: color }],
              pressed && styles.pressed,
            ]}
          >
            <EventGlyph value={toIconValue(key)} size={20} color={active ? deepText(color) : colors.text} />
          </Pressable>
        );
      })}
    </View>
  );
}

/** Square button showing the current icon; used at the start of event/stamp title cards. */
export function IconButtonTile({ value, color, onPress }: { value?: string; color: string; onPress: () => void }) {
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      accessibilityLabel="Choose icon"
      style={({ pressed }) => [styles.tile, { backgroundColor: softBg(color) }, pressed && styles.pressed]}
    >
      <EventGlyph value={value} fallback="event" size={24} color={deepText(color)} />
    </Pressable>
  );
}

const useStyles = createStyles((colors) => ({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, padding: 14 },
  cell: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.bg,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  cellActive: { borderColor: colors.primary },
  legacy: { fontSize: 22 },
  pressed: { opacity: 0.7 },
  tile: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
}));
