import React, { useState } from 'react';
import { Pressable, Text, TextInput, View } from 'react-native';
import { useCalendarContext } from '../context/CalendarContext';
import type { SavedColor } from '../models/SavedColor';
import { createStyles, NAMED_PALETTE, PALETTE, radius, useTheme } from '../theme';
import { normalizeHex, readableOn } from '../utils/color';
import { colorName } from '../utils/colorNames';
import { confirmAsync } from '../utils/confirm';
import { ColorWheel } from './ColorWheel';
import { Sheet } from './Sheet';
import { Icon } from './Icon';
import { Button, TextField } from './ui';

/**
 * Named palette, the user's saved colors, color wheel and manual hex input. When `inheritColor` is given, clearing the value
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
  const styles = useStyles();
  const { colors } = useTheme();
  const [text, setText] = useState(value ?? '');
  // Follow outside changes (palette, wheel, reset) but keep a half-typed value that already matches.
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    if (normalizeHex(text, false) !== (value ?? null)) setText(value ?? '');
  }

  const { savedColors, saveColor, deleteSavedColor } = useCalendarContext();
  const current = value ?? inheritColor ?? PALETTE[0]!;
  const upper = current.toUpperCase();
  const inPalette = PALETTE.includes(upper);
  const saved = savedColors.find((c) => c.hex === upper);
  const name = colorName(current, savedColors);
  const [wheelOpen, setWheelOpen] = useState(false);
  // Save / rename sheet: `editing` is set when renaming an existing saved color.
  const [naming, setNaming] = useState<{ hex: string; editing?: SavedColor } | null>(null);
  const [draftName, setDraftName] = useState('');
  const openNaming = (hex: string, editing?: SavedColor) => {
    setDraftName(editing?.name ?? '');
    setNaming({ hex, editing });
  };
  const commitName = () => {
    const trimmed = draftName.trim();
    if (!naming || !trimmed) return;
    saveColor(trimmed, naming.hex);
    setNaming(null);
  };
  const removeSaved = async (c: SavedColor) => {
    setNaming(null);
    if (await confirmAsync(`Delete “${c.name}”?`, 'Events already using this color keep it.', 'Delete', true)) deleteSavedColor(c.id);
  };
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
          <Text style={styles.previewTitle} numberOfLines={1}>
            {value ? (name ?? 'Custom color') : inheritColor ? `Calendar color${name ? ` · ${name}` : ''}` : (name ?? 'Color')}
          </Text>
          <Text style={styles.previewHex}>{upper}</Text>
        </View>
        {value && !inPalette && !saved ? (
          <Button small variant="secondary" title="Save" onPress={() => openNaming(upper)} />
        ) : null}
        {value && inheritColor ? <Button small variant="secondary" title="Reset" onPress={() => onChange(undefined)} /> : null}
      </View>

      <View style={styles.grid}>
        {NAMED_PALETTE.map(({ hex: c, name: swatchName }) => {
          const active = upper === c;
          return (
            <Pressable
              key={c}
              onPress={() => onChange(c)}
              accessibilityLabel={swatchName}
              accessibilityState={{ selected: active }}
              style={[styles.swatch, { backgroundColor: c }, active && styles.swatchActive]}
            >
              {active ? <Icon name="check" size={16} color={readableOn(c)} strokeWidth={3} /> : null}
            </Pressable>
          );
        })}
        <Pressable
          onPress={() => setWheelOpen(true)}
          accessibilityLabel="Pick from color wheel"
          style={[styles.swatch, styles.customSwatch, !inPalette && [styles.customActive, { backgroundColor: current }]]}
        >
          <Icon name="pipette" size={16} color={inPalette ? colors.text : readableOn(current)} />
        </Pressable>
      </View>

      {savedColors.length > 0 ? (
        <View style={styles.savedBlock}>
          <Text style={styles.savedTitle}>YOUR COLORS</Text>
          <View style={styles.savedRow}>
            {savedColors.map((c) => {
              const active = upper === c.hex;
              return (
                <Pressable
                  key={c.id}
                  onPress={() => onChange(c.hex)}
                  onLongPress={() => openNaming(c.hex, c)}
                  delayLongPress={350}
                  accessibilityLabel={`${c.name}. Long press to rename or delete`}
                  accessibilityState={{ selected: active }}
                  style={({ pressed }) => [styles.savedChip, active && styles.savedChipActive, pressed && styles.pressed]}
                >
                  <View style={[styles.savedDot, { backgroundColor: c.hex }]}>
                    {active ? <Icon name="check" size={11} color={readableOn(c.hex)} strokeWidth={3} /> : null}
                  </View>
                  <Text style={styles.savedName} numberOfLines={1}>
                    {c.name}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <Text style={styles.savedHint}>Long-press a saved color to rename or delete it.</Text>
        </View>
      ) : null}

      {/* In a sheet so opening the wheel never shifts the form around it. */}
      <Sheet visible={wheelOpen} onClose={() => setWheelOpen(false)} title="Custom color">
        <View style={styles.wheelSheet}>
          <View style={styles.wheelPreview}>
            <View style={[styles.wheelSwatch, { backgroundColor: current }]} />
            <Text style={styles.wheelHex}>{current.toUpperCase()}</Text>
          </View>
          <ColorWheel value={current} onChange={(hex) => onChange(hex)} />
          {!inPalette && !saved ? (
            <Button
              variant="secondary"
              title="Save this color"
              onPress={() => {
                setWheelOpen(false);
                // Let the wheel sheet slide away before the naming sheet opens.
                setTimeout(() => openNaming(upper), 260);
              }}
            />
          ) : null}
        </View>
      </Sheet>

      <Sheet
        visible={naming !== null}
        onClose={() => setNaming(null)}
        title={naming?.editing ? 'Edit color' : 'Save color'}
        actionLabel="Cancel"
      >
        {naming ? (
          <View style={styles.nameSheet}>
            <View style={styles.wheelPreview}>
              <View style={[styles.wheelSwatch, { backgroundColor: naming.hex }]} />
              <Text style={styles.wheelHex}>{naming.hex}</Text>
            </View>
            <TextField
              value={draftName}
              onChangeText={setDraftName}
              placeholder="Name, e.g. Ocean"
              autoFocus
              maxLength={24}
              returnKeyType="done"
              onSubmitEditing={commitName}
            />
            <Button title={naming.editing ? 'Save name' : 'Save color'} onPress={commitName} disabled={!draftName.trim()} />
            {naming.editing ? (
              <Button variant="danger" title="Delete saved color" onPress={() => void removeSaved(naming.editing!)} />
            ) : null}
          </View>
        ) : null}
      </Sheet>

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

const useStyles = createStyles((colors) => ({
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
  customActive: { borderColor: colors.text, borderStyle: 'solid' },
  wheelSheet: { gap: 14, paddingBottom: 8 },
  wheelPreview: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  wheelSwatch: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, borderColor: colors.surface },
  wheelHex: { fontSize: 17, fontWeight: '700', color: colors.text, fontVariant: ['tabular-nums'] },
  pressed: { opacity: 0.7 },
  savedBlock: { gap: 8 },
  savedTitle: { fontSize: 11, fontWeight: '700', letterSpacing: 1.4, color: colors.textMuted },
  savedRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  savedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    paddingVertical: 5,
    paddingLeft: 5,
    paddingRight: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.bg,
    maxWidth: 170,
  },
  savedChipActive: { borderColor: colors.text },
  savedDot: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  savedName: { flexShrink: 1, fontSize: 14, fontWeight: '600', color: colors.text },
  savedHint: { fontSize: 12, color: colors.textFaint },
  nameSheet: { gap: 14, paddingBottom: 8 },
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
}));
