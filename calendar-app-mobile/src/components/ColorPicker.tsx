import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, PALETTE, radius } from '../theme';
import { normalizeHex, readableOn } from '../utils/color';
import { ColorWheel } from './ColorWheel';
import { Icon } from './Icon';
import { Button } from './ui';

/**
 * Palette, color wheel and manual hex input. When `inheritColor` is given, clearing the value
 * (Reset / empty hex) falls back to the inherited calendar color.
 */
export function ColorPicker({
  value,
  onChange,
  inheritColor,
}: {
  value?: string;
  onChange: (hex: string | undefined) => void;
  inheritColor?: string;
}) {
  const [text, setText] = useState(value ?? '');
  useEffect(() => {
    setText((prev) => (normalizeHex(prev, false) === (value ?? null) ? prev : value ?? ''));
  }, [value]);

  const current = value ?? inheritColor ?? PALETTE[0]!;
  const inPalette = PALETTE.some((c) => c.toUpperCase() === current.toUpperCase());
  const [wheelOpen, setWheelOpen] = useState(() => !inPalette);
  const valid = text.trim() === '' || normalizeHex(text) !== null;

  const onChangeText = (t: string) => {
    setText(t);
    const hex = normalizeHex(t, false);
    if (hex) onChange(hex);
    else if (t.trim() === '' && inheritColor) onChange(undefined);
  };

  const onBlur = () => {
    const hex = normalizeHex(text);
    if (hex) {
      setText(hex);
      onChange(hex);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.previewRow}>
        <View style={[styles.preview, { backgroundColor: current }]}>
          <Text style={[styles.previewLetter, { color: readableOn(current) }]}>Aa</Text>
        </View>
        <View style={styles.previewInfo}>
          <Text style={styles.previewTitle}>
            {value ? 'Custom color' : inheritColor ? 'Using calendar color' : 'Color'}
          </Text>
          <Text style={styles.previewHex}>{current.toUpperCase()}</Text>
        </View>
        {value && inheritColor ? <Button small variant="secondary" title="Reset" onPress={() => onChange(undefined)} /> : null}
      </View>

      <View style={styles.grid}>
        {PALETTE.map((c) => {
          const active = current.toUpperCase() === c.toUpperCase();
          return (
            <Pressable
              key={c}
              onPress={() => onChange(c)}
              accessibilityLabel={`Color ${c}`}
              style={[styles.swatch, { backgroundColor: c }, active && styles.swatchActive]}
            >
              {active ? <Icon name="check" size={16} color={readableOn(c)} strokeWidth={3} /> : null}
            </Pressable>
          );
        })}
        <Pressable
          onPress={() => setWheelOpen((o) => !o)}
          accessibilityLabel={wheelOpen ? 'Hide color wheel' : 'Pick from color wheel'}
          accessibilityState={{ expanded: wheelOpen }}
          style={[styles.swatch, styles.customSwatch, !inPalette && { backgroundColor: current }, wheelOpen && styles.customOpen]}
        >
          <Icon name="pipette" size={16} color={inPalette ? colors.text : readableOn(current)} />
        </Pressable>
      </View>

      {wheelOpen ? <ColorWheel value={current} onChange={(hex) => onChange(hex)} /> : null}

      <View style={styles.hexRow}>
        <Text style={styles.hexLabel}>HEX</Text>
        <TextInput
          value={text}
          onChangeText={onChangeText}
          onBlur={onBlur}
          placeholder={inheritColor ? `${inheritColor} (inherited)` : '#RRGGBB'}
          placeholderTextColor={colors.textFaint}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={7}
          style={[styles.hexInput, !valid && styles.hexInvalid]}
        />
      </View>
      {!valid ? <Text style={styles.error}>Use a 3 or 6 digit hex code, e.g. #FF8800</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 14 },
  previewRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  preview: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  previewLetter: { fontWeight: '700', fontSize: 15 },
  previewInfo: { flex: 1 },
  previewTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  previewHex: { fontSize: 13, color: colors.textMuted, marginTop: 2, fontVariant: ['tabular-nums'] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  swatch: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  swatchActive: { borderWidth: 3, borderColor: colors.surface, outlineColor: colors.text, transform: [{ scale: 1.08 }] },
  customSwatch: { backgroundColor: colors.bg, borderWidth: 1.5, borderColor: colors.border, borderStyle: 'dashed' },
  customOpen: { borderColor: colors.text, borderStyle: 'solid' },
  hexRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  hexLabel: { fontSize: 13, fontWeight: '700', color: colors.textMuted },
  hexInput: {
    flex: 1,
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.bg,
    borderRadius: radius.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: colors.border,
    fontVariant: ['tabular-nums'],
  },
  hexInvalid: { borderColor: colors.danger },
  error: { fontSize: 12, color: colors.danger, marginTop: -6 },
});
