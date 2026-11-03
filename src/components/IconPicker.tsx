import React, { useEffect, useState } from 'react';
import { InteractionManager, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { createStyles, radius, spacing, useTheme } from '../theme';
import { deepText, softBg } from '../utils/color';
import { EMOJI_GROUPS } from '../utils/emojiList';
import { EVENT_ICONS, EventGlyph, eventIconKey, Icon, toIconValue, type EventIconKey } from './Icon';
import { Sheet } from './Sheet';
import { TextField } from './ui';

const KEYS = Object.keys(EVENT_ICONS) as EventIconKey[];

/**
 * True once the screen has settled after opening. Screens use it to build the icon grid (about 40 SVGs) hidden in the
 * background, so tapping the icon tile just shows it instead of waiting for it to render.
 */
export function useIconPickerReady(): boolean {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => setReady(true));
    return () => task.cancel();
  }, []);
  return ready;
}

/**
 * Floats the icon grid as a card over the content just below its parent (the title card), so opening it doesn't move
 * anything. The parent needs a `zIndex`. Touches inside don't reach the screen's "touch anywhere to close" handler.
 * While closed the grid stays built but hidden, so it opens instantly.
 */
export function IconPickerLayer({ open, children }: { open: boolean; children: React.ReactNode }) {
  const styles = useStyles();
  return (
    <View style={[styles.layer, !open && styles.layerHidden]} onTouchStart={(e) => e.stopPropagation()}>
      {children}
    </View>
  );
}

/** Grid of SVG icons for events and stamps, plus a button for any emoji. Stores `icon:<key>`, or the emoji itself, in the `emoji` field. */
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
  const [emojiOpen, setEmojiOpen] = useState(false);
  // Build the (large) emoji sheet only once it has been asked for, so the icon menu opens quickly.
  const [emojiUsed, setEmojiUsed] = useState(false);
  const [typed, setTyped] = useState('');
  const pickEmoji = (emoji: string) => {
    onChange(emoji);
    setEmojiOpen(false);
    setTyped('');
  };
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
      <Pressable
        onPress={() => {
          setEmojiUsed(true);
          setEmojiOpen(true);
        }}
        accessibilityLabel="More emojis"
        style={({ pressed }) => [styles.emojiButton, pressed && styles.pressed]}
      >
        <Text style={styles.emojiButtonFace}>😀</Text>
        <Text style={styles.emojiButtonText}>Choose an emoji instead</Text>
        <Icon name="chevron-right" size={18} color={colors.textFaint} />
      </Pressable>
      {emojiUsed ? <Sheet visible={emojiOpen} onClose={() => setEmojiOpen(false)} title="Emojis">
        <TextField
          value={typed}
          onChangeText={setTyped}
          onSubmitEditing={() => typed.trim() && pickEmoji(typed.trim())}
          placeholder="Or use your keyboard's emoji button…"
          autoCorrect={false}
          maxLength={16}
          returnKeyType="done"
          accessibilityLabel="Type an emoji"
        />
        {typed.trim() ? (
          <Pressable onPress={() => pickEmoji(typed.trim())} style={styles.useTyped} accessibilityLabel="Use typed emoji">
            <Text style={styles.useTypedText}>Use {typed.trim()}</Text>
          </Pressable>
        ) : null}
        <ScrollView style={styles.emojiScroll} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
          {emojiOpen
            ? EMOJI_GROUPS.map((g) => (
                <View key={g.title}>
                  <Text style={styles.groupTitle}>{g.title}</Text>
                  <View style={styles.emojiGrid}>
                    {g.emoji.map((e) => (
                      <Pressable key={e} onPress={() => pickEmoji(e)} style={styles.emojiCell} accessibilityLabel={`Emoji ${e}`}>
                        <Text style={styles.emojiText}>{e}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              ))
            : null}
        </ScrollView>
      </Sheet> : null}
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
  emojiButton: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginTop: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.bg,
  },
  emojiButtonFace: { fontSize: 24 },
  emojiButtonText: { flex: 1, fontSize: 16, fontWeight: '500', color: colors.text },
  layer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    marginTop: -spacing.sm,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    elevation: 8,
    shadowColor: '#000',
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
  },
  layerHidden: { display: 'none' },
  emojiScroll: { maxHeight: 360, marginTop: spacing.sm },
  groupTitle: { fontSize: 12, fontWeight: '600', letterSpacing: 0.6, textTransform: 'uppercase', color: colors.textMuted, paddingVertical: spacing.sm },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  emojiCell: { width: '12.5%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center' },
  emojiText: { fontSize: 26 },
  useTyped: { alignSelf: 'flex-start', marginTop: spacing.sm, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.md, backgroundColor: colors.bg },
  useTypedText: { fontSize: 16, color: colors.text },
  pressed: { opacity: 0.7 },
  tile: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
}));
