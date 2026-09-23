import React from 'react';
import {
  Pressable,
  StyleProp,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewStyle,
} from 'react-native';
import { colors, radius, spacing } from '../theme';
import { deepText, softBg } from '../utils/color';

type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

const BUTTON_COLORS: Record<ButtonVariant, { bg: string; fg: string }> = {
  primary: { bg: colors.primary, fg: '#FFFFFF' },
  secondary: { bg: colors.primarySoft, fg: colors.primary },
  danger: { bg: colors.dangerSoft, fg: colors.danger },
  ghost: { bg: 'transparent', fg: colors.primary },
};

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
  const palette = BUTTON_COLORS[variant];
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: palette.bg },
        pressed && styles.pressed,
        disabled && styles.disabled,
        style,
      ]}
    >
      <Text style={[styles.buttonText, small && styles.buttonTextSmall, { color: palette.fg }]}>{title}</Text>
    </Pressable>
  );
}

export function IconButton({
  icon,
  onPress,
  accessibilityLabel,
  size = 38,
}: {
  icon: string;
  onPress: () => void;
  accessibilityLabel: string;
  size?: number;
}) {
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
      <Text style={styles.iconText}>{icon}</Text>
    </Pressable>
  );
}

export function HeaderButton({ title, onPress, bold = false }: { title: string; onPress: () => void; bold?: boolean }) {
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
  return (
    <Pressable
      onPress={onPress}
      disabled={!onPress}
      accessibilityState={{ selected }}
      style={({ pressed }) => [
        styles.chip,
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
  const content = (
    <>
      {left ? <View style={styles.rowLeft}>{left}</View> : null}
      <View style={styles.rowBody}>
        <Text style={[styles.rowLabel, destructive && { color: colors.danger }]}>{label}</Text>
        {subtitle ? <Text style={styles.rowSubtitle}>{subtitle}</Text> : null}
      </View>
      {value ? <Text style={styles.rowValue}>{value}</Text> : null}
      {right}
      {onPress ? <Text style={styles.chevron}>›</Text> : null}
    </>
  );
  if (!onPress) return <View style={styles.row}>{content}</View>;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, pressed && { backgroundColor: colors.surfaceAlt }]}>
      {content}
    </Pressable>
  );
}

export const Divider = () => <View style={styles.divider} />;

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.field}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
    </View>
  );
}

export function TextField(props: TextInputProps) {
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
        thumbColor="#FFFFFF"
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
  return (
    <View style={styles.segmented}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            onPress={() => onChange(o.value)}
            accessibilityState={{ selected: active }}
            style={[styles.segment, active && styles.segmentActive]}
          >
            <Text style={[styles.segmentText, active && styles.segmentTextActive]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export function Stepper({
  value,
  onChange,
  min = 1,
  max = 999,
  step = 1,
  format,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  format?: (v: number) => string;
}) {
  return (
    <View style={styles.stepper}>
      <Pressable
        style={[styles.stepperButton, value <= min && styles.disabled]}
        disabled={value <= min}
        onPress={() => onChange(Math.max(min, value - step))}
        accessibilityLabel="Decrease"
      >
        <Text style={styles.stepperGlyph}>−</Text>
      </Pressable>
      <Text style={styles.stepperValue}>{format ? format(value) : value}</Text>
      <Pressable
        style={[styles.stepperButton, value >= max && styles.disabled]}
        disabled={value >= max}
        onPress={() => onChange(Math.min(max, value + step))}
        accessibilityLabel="Increase"
      >
        <Text style={styles.stepperGlyph}>+</Text>
      </Pressable>
    </View>
  );
}

export function EmptyState({ emoji, title, subtitle, children }: { emoji: string; title: string; subtitle?: string; children?: React.ReactNode }) {
  return (
    <View style={styles.empty}>
      <Text style={styles.emptyEmoji}>{emoji}</Text>
      <Text style={styles.emptyTitle}>{title}</Text>
      {subtitle ? <Text style={styles.emptySubtitle}>{subtitle}</Text> : null}
      {children}
    </View>
  );
}

export const ColorDot = ({ color, size = 12 }: { color: string; size?: number }) => (
  <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />
);

const styles = StyleSheet.create({
  pressed: { opacity: 0.7 },
  disabled: { opacity: 0.4 },
  bold: { fontWeight: '700' },
  button: {
    paddingVertical: 13,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSmall: { paddingVertical: 7, paddingHorizontal: spacing.md, borderRadius: radius.sm },
  buttonText: { fontSize: 16, fontWeight: '600' },
  buttonTextSmall: { fontSize: 14 },
  iconButton: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.surface },
  iconText: { fontSize: 18, color: colors.text },
  headerButton: { paddingHorizontal: 4, paddingVertical: 4 },
  headerButtonText: { fontSize: 16, color: colors.primary },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  chipSelected: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  chipDot: { width: 10, height: 10, borderRadius: 5, borderWidth: 2 },
  chipText: { fontSize: 14, color: colors.textMuted, fontWeight: '500' },
  chipTextSelected: { color: colors.primary, fontWeight: '600' },
  section: { marginBottom: spacing.lg },
  sectionTitle: {
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.6,
    color: colors.textMuted,
    marginBottom: 6,
    marginLeft: spacing.xs,
  },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, overflow: 'hidden' },
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
  rowLabel: { fontSize: 16, color: colors.text },
  rowSubtitle: { fontSize: 13, color: colors.textMuted, marginTop: 2 },
  rowValue: { fontSize: 15, color: colors.textMuted },
  chevron: { fontSize: 22, color: colors.textFaint, marginTop: -2 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginLeft: spacing.lg },
  field: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, gap: 8 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: colors.textMuted },
  input: {
    fontSize: 16,
    color: colors.text,
    backgroundColor: colors.surfaceAlt,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 11,
  },
  inputMultiline: { minHeight: 88, textAlignVertical: 'top' },
  segmented: { flexDirection: 'row', backgroundColor: colors.surfaceAlt, borderRadius: radius.md, padding: 3 },
  segment: { flex: 1, paddingVertical: 7, alignItems: 'center', borderRadius: 9 },
  segmentActive: {
    backgroundColor: colors.surface,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  segmentText: { fontSize: 14, color: colors.textMuted, fontWeight: '500' },
  segmentTextActive: { color: colors.text, fontWeight: '600' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  stepperButton: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperGlyph: { fontSize: 18, color: colors.primary, fontWeight: '600' },
  stepperValue: { minWidth: 56, textAlign: 'center', fontSize: 16, fontWeight: '600', color: colors.text },
  empty: { alignItems: 'center', padding: spacing.xl, gap: spacing.sm },
  emptyEmoji: { fontSize: 40 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: colors.text, textAlign: 'center' },
  emptySubtitle: { fontSize: 14, color: colors.textMuted, textAlign: 'center', lineHeight: 20 },
});
