import React from 'react';
import { Text, View } from 'react-native';
import { createStyles, fonts, spacing } from '../theme';
import { formatDuration } from '../utils/format';
import { Chip, Stepper } from './ui';

const PRESETS = [15, 30, 45, 60, 90, 120];
const MAX_MINUTES = 24 * 60 - 1;

/** Minute-accurate duration: quick presets plus hour and minute steppers (type or hold to change). */
export function DurationField({ value, onChange }: { value: number; onChange: (minutes: number) => void }) {
  const styles = useStyles();
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  const set = (h: number, m: number) => onChange(Math.min(MAX_MINUTES, Math.max(1, h * 60 + m)));

  return (
    <View style={styles.container}>
      <Text style={styles.total}>{formatDuration(value)}</Text>
      <View style={styles.row}>
        <View style={styles.unit}>
          <Stepper value={hours} min={0} max={23} onChange={(h) => set(h, minutes)} />
          <Text style={styles.unitLabel}>hours</Text>
        </View>
        <View style={styles.unit}>
          {/* Minutes roll over into hours so holding + keeps counting past 59. */}
          <Stepper
            value={minutes}
            min={hours === 0 ? 1 : -1}
            max={60}
            onChange={(m) => set(hours, m)}
            format={(v) => String(Math.max(0, Math.min(59, v))).padStart(2, '0')}
          />
          <Text style={styles.unitLabel}>minutes</Text>
        </View>
      </View>
      <View style={styles.presets}>
        {PRESETS.map((m) => (
          <Chip key={m} label={formatDuration(m)} selected={value === m} onPress={() => onChange(m)} />
        ))}
      </View>
    </View>
  );
}

const useStyles = createStyles((colors) => ({
  container: { gap: spacing.md },
  total: { fontFamily: fonts.display, fontSize: 26, color: colors.text },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg },
  unit: { alignItems: 'center', gap: 4 },
  unitLabel: { fontSize: 12, fontWeight: '600', color: colors.textMuted, letterSpacing: 0.4 },
  presets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
}));
