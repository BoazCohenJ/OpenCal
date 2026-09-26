import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  type PressableProps,
  StyleProp,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { createStyles, fonts, type Palette, radius, spacing, useTheme } from '../theme';
import { deepText, softBg } from '../utils/color';
import { Icon, type IconName } from './Icon';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

const buttonColors = (colors: Palette): Record<ButtonVariant, { bg: string; fg: string }> => ({
  primary: { bg: colors.primary, fg: colors.onPrimary },
  secondary: { bg: colors.primarySoft, fg: colors.primary },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
  ghost: { bg: 'transparent', fg: colors.primary },
});

/**
 * Pressable that dips slightly while pressed and springs back on release.
 * `style` is the visual box (it scales); `containerStyle` is layout on the outer touch target.
 */
export function PressableScale({
  children,
  style,
  containerStyle,
  scaleTo = 0.96,
  onPressIn,
  onPressOut,
  ...rest
}: Omit<PressableProps, 'style' | 'children'> & {
  style?: StyleProp<ViewStyle>;
  containerStyle?: StyleProp<ViewStyle>;
  scaleTo?: number;
  children?: React.ReactNode;
}) {
  const scale = useState(() => new Animated.Value(1))[0];
  const to = (value: number) =>
    Animated.spring(scale, { toValue: value, useNativeDriver: true, speed: 40, bounciness: value === 1 ? 8 : 0 }).start();
  return (
    <Pressable
      {...rest}
      style={containerStyle}
      onPressIn={(e) => {
        to(scaleTo);
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        to(1);
        onPressOut?.(e);
      }}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  small = false,
  disabled = false,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  small?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const palette = buttonColors(colors)[variant];
  // Layout props (flex, alignSelf) go on the touch target so buttons can share a row.
  const { flex, alignSelf, ...visual } = StyleSheet.flatten(style) ?? {};
  return (
    <PressableScale
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      scaleTo={0.97}
      containerStyle={{ flex, alignSelf }}
      style={[styles.button, small && styles.buttonSmall, { backgroundColor: palette.bg }, disabled && styles.disabled, visual]}
    >
      <Text style={[styles.buttonText, small && styles.buttonTextSmall, { color: palette.fg }]}>{title}</Text>
    </PressableScale>
  );
}

export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  size = 38,
}: {
  icon: IconName;
  onPress: () => void;
  accessibilityLabel: string;
  size?: number;
}) {
  const styles = useStyles();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        styles.iconButton,
        { width: size, height: size, borderRadius: size / 2 },
        pressed && styles.pressed,
      ]}
    >
      <Icon name={icon} size={Math.round(size * 0.47)} />
    </Pressable>
  );
}

export function HeaderButton({ title, onPress, bold = false }: { title: string; onPress: () => void; bold?: boolean }) {
  const styles = useStyles();
  return (
    <Pressable onPress={onPress} hitSlop={10} style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}>
      <Text style={[styles.headerButtonText, bold && styles.bold]}>{title}</Text>
    </Pressable>
  );
}

export function Chip({
  label,
  selected = false,
  onPress,
  color,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  color?: string;
}) {
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.chip,
        color && !selected && styles.chipOff,
        selected && styles.chipSelected,
        selected && color ? { backgroundColor: softBg(color), borderColor: color } : null,
        pressed && styles.pressed,
      ]}
    >
      {color ? (
        <View style={[styles.chipDot, { borderColor: color, backgroundColor: selected ? color : 'transparent' }]} />
      ) : null}
      <Text
        style={[
          styles.chipText,
          selected && styles.chipTextSelected,
          selected && color ? { color: deepText(color) } : null,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

export function Section({
  title,
  footer,
  children,
  style,
}: {
  title?: string;
  footer?: string;
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  return (
    <View style={[styles.section, style]}>
      {title ? <Text style={styles.sectionTitle}>{title.toUpperCase()}</Text> : null}
      <View style={styles.card}>{children}</View>
      {footer ? <Text style={styles.sectionFooter}>{footer}</Text> : null}
    </View>
  );
}

export function Row({
  label,
  subtitle,
  value,
  onPress,
  left,
  right,
  destructive = false,
}: {
  label: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
  left?: React.ReactNode;
  right?: React.ReactNode;
  destructive?: boolean;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const content = (
    <>
      {left ? <View style={styles.rowLeft}>{left}</View> : null}
      <View style={styles.rowBody}>
        <Text style={[styles.rowLabel, destructive && { color: colors.danger }]}>{label}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      {right}
      {onPress ? <Icon name="chevron-right" size={18} color={colors.textFaint} /> : null}
    </>
  );
  if (!onPress) return <View style={styles.row}>{content}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceAlt }]}>
      {content}
    </Pressable>
  );
}

export function Divider() {
  const styles = useStyles();
  return <View style={styles.divider} />;
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

export function TextField(props: TextInputProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <TextInput
      placeholderTextColor={colors.textFaint}
      {...props}
      style={[styles.input, props.multiline && styles.inputMultiline, props.style]}
    />
  );
}

export function SwitchRow({
  label,
  subtitle,
  value,
  onValueChange,
}: {
  label: string;
  subtitle?: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <View style={styles.rowBody}>
        <Text style={styles.rowLabel}>{label}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ true: colors.primary, false: colors.border }}
        thumbColor={colors.surface}
      />
    </View>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const styles = useStyles();
  const [width, setWidth] = useState(0);
  const index = Math.max(0, options.findIndex((o) => o.value === value));
  const segmentWidth = width > 0 ? (width - 6) / options.length : 0;
  const x = useState(() => new Animated.Value(index))[0];
  useEffect(() => {
    Animated.spring(x, { toValue: index, useNativeDriver: true, damping: 20, stiffness: 260, mass: 0.7 }).start();
  }, [index, x]);
  // Build the animated node once per width: recreating it every render can detach a running
  // native-driver animation on iOS/Android and leave the highlight stuck on the old option.
  const translateX = useMemo(() => Animated.multiply(x, segmentWidth), [x, segmentWidth]);
  return (
    <View style={styles.segmented} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      {segmentWidth > 0 ? (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.segmentIndicator,
            { width: segmentWidth, transform: [{ translateX }] },
          ]}
        />
      ) : null}
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            style={[styles.segment, active && segmentWidth === 0 && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]} numberOfLines={1}>
              {o.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Press-and-hold repeat that speeds up the longer it is held. */
function useHoldRepeat(action: () => void) {
  const latest = useRef(action);
  useLayoutEffect(() => {
    latest.current = action;
  });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repeated = useRef(false);
  const stop = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);
  const start = useCallback(() => {
    stop();
    repeated.current = false;
    let delay = 380;
    const tick = () => {
      repeated.current = true;
      latest.current();
      delay = Math.max(40, delay * 0.8);
      timer.current = setTimeout(tick, delay);
    };
    timer.current = setTimeout(tick, delay);
  }, [stop]);
  useEffect(() => stop, [stop]);
  // The release after a hold also fires onPress; skip it so a hold doesn't overshoot by one step.
  const onPress = useCallback(() => {
    if (!repeated.current) latest.current();
    repeated.current = false;
  }, []);
  return { onPressIn: start, onPressOut: stop, onPress };
}

/**
 * −/+ number control. Tap to step, hold to repeat (accelerating), or tap the value to type it.
 * `format` is only used for display; typing always edits the raw number.
 */
export function Stepper({
  value,
  onChange,
  min = 1,
  max = 999,
  step = 1,
  format,
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  format?: (v: number) => string;
  /** Unit shown after the raw number while typing, e.g. "min". */
  suffix?: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const clamp = (v: number) => Math.min(max, Math.max(min, v));
  const valueRef = useRef(value);
  useLayoutEffect(() => {
    valueRef.current = value;
  });
  const bump = (dir: 1 | -1) => {
    const next = clamp(valueRef.current + dir * step);
    valueRef.current = next;
    onChange(next);
  };
  const down = useHoldRepeat(() => bump(-1));
  const up = useHoldRepeat(() => bump(1));
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => {
    const n = parseInt(draft ?? '', 10);
    if (Number.isFinite(n)) onChange(clamp(n));
    setDraft(null);
  };
  return (
    <View style={styles.stepper}>
      <Pressable
        style={({ pressed }) => [styles.stepperButton, value <= min && styles.disabled, pressed && styles.pressed]}
        disabled={value <= min}
        {...down}
        accessibilityLabel="Decrease"
      >
        <Icon name="minus" size={16} color={colors.primary} strokeWidth={2.5} />
      </Pressable>
      {draft !== null ? (
        <View style={styles.stepperEdit}>
          <TextInput
            value={draft}
            onChangeText={(t) => {
              const digits = t.replace(/[^0-9]/g, '');
              setDraft(digits);
              // Apply valid values live; out-of-range input is clamped when the field closes.
              const n = parseInt(digits, 10);
              if (Number.isFinite(n) && n >= min && n <= max) onChange(n);
            }}
            onBlur={commit}
            onSubmitEditing={commit}
            keyboardType="number-pad"
            autoFocus
            selectTextOnFocus
            maxLength={5}
            style={styles.stepperInput}
          />
          {suffix ? <Text style={styles.stepperSuffix}>{suffix}</Text> : null}
        </View>
      ) : (
        <Pressable onPress={() => setDraft(String(value))} accessibilityLabel="Type a value" hitSlop={6}>
          <Text style={styles.stepperValue}>{format ? format(value) : value}</Text>
        </Pressable>
      )}
      <Pressable
        style={({ pressed }) => [styles.stepperButton, value >= max && styles.disabled, pressed && styles.pressed]}
        disabled={value >= max}
        {...up}
        accessibilityLabel="Increase"
      >
        <Icon name="plus" size={16} color={colors.primary} strokeWidth={2.5} />
      </Pressable>
    </View>
  );
}

export function EmptyState({ icon, title, subtitle, children }: { icon: IconName; title: string; subtitle?: string; children?: React.ReactNode }) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={styles.empty}>
      <View style={styles.emptyIcon}>
        <Icon name={icon} size={28} color={colors.primary} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={styles.emptySubtitle}>{subtitle}</Text> : null}
      {children}
    </View>
  );
}

export const ColorDot = ({ color, size = 12 }: { color: string; size?: number }) => (
  <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />
);

const useStyles = createStyles((colors) => ({
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.4 },
  bold: { fontWeight: '700' },
  button: {
    paddingVertical: 14,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSmall: { paddingVertical: 7, paddingHorizontal: spacing.md, borderRadius: radius.sm },
  buttonText: { fontSize: 16, fontWeight: '700', letterSpacing: 0.1 },
  buttonTextSmall: { fontSize: 14 },
  iconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  headerButton: { paddingHorizontal: 4, paddingVertical: 4 },
  headerButtonText: { fontSize: 16, color: colors.primary, fontWeight: '500' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    // Set explicitly: Android keeps a dashed border after `chipOff` is removed unless told otherwise.
    borderStyle: 'solid',
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipOff: { borderStyle: 'dashed', backgroundColor: 'transparent' },
  chipSelected: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  chipDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
  chipText: { fontSize: 14, color: colors.textMuted, fontWeight: '500' },
  chipTextSelected: { color: colors.primary, fontWeight: '600' },
  section: { marginBottom: spacing.lg },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.4,
    color: colors.textMuted,
    marginBottom: 8,
    marginLeft: spacing.xs,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  sectionFooter: { fontSize: 12, color: colors.textMuted, marginTop: 6, marginHorizontal: spacing.xs, lineHeight: 17 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: 13,
    minHeight: 50,
  },
  rowLeft: { alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1 },
  rowLabel: { fontSize: 16, color: colors.text, fontWeight: '500' },
  rowSubtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  rowValue: { fontSize: 15, color: colors.textMuted },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.hairline, marginLeft: spacing.lg },
  field: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: 8 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  input: {
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.bg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
  },
  inputMultiline: { minHeight: 88, textAlignVertical: 'top' },
  segmented: { flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: radius.pill, padding: 3 },
  segment: { flex: 1, paddingVertical: 7, alignItems: 'center', borderRadius: radius.pill },
  segmentActive: { backgroundColor: colors.ink },
  segmentIndicator: { position: 'absolute', top: 3, bottom: 3, left: 3, borderRadius: radius.pill, backgroundColor: colors.ink },
  segmentText: { fontSize: 14, color: colors.textMuted, fontWeight: '600' },
  segmentTextActive: { color: colors.onInk, fontWeight: '700' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepperButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperEdit: { flexDirection: 'row', alignItems: 'center', gap: 4, justifyContent: 'center' },
  stepperInput: {
    width: 56,
    textAlign: 'center',
    fontSize: 16,
    fontWeight: '700',
    color: colors.text,
    backgroundColor: colors.bg,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    paddingVertical: 4,
    paddingHorizontal: 6,
  },
  stepperSuffix: { fontSize: 13, color: colors.textMuted, fontWeight: '600' },
  stepperValue: { minWidth: 56, textAlign: 'center', fontSize: 16, fontWeight: '600', color: colors.text },
  empty: { alignItems: 'center', padding: spacing.xl, gap: spacing.sm },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  emptyTitle: { fontSize: 22, fontFamily: fonts.display, color: colors.text, textAlign: 'center' },
  emptySubtitle: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
}));
