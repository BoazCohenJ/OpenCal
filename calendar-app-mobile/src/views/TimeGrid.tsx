import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../theme';
import { minutesSinceMidnight } from '../utils/dates';
import { HOUR_HEIGHT, PX_PER_MIN } from './layout';

export const GUTTER_WIDTH = 52;
export const GRID_HEIGHT = HOUR_HEIGHT * 24;
const HOURS = Array.from({ length: 24 }, (_, h) => h);

const hourLabel = (h: number) => (h === 0 ? '' : h === 12 ? '12 PM' : h < 12 ? `${h} AM` : `${h - 12} PM`);

export function HourGutter() {
  return (
    <View style={{ width: GUTTER_WIDTH, height: GRID_HEIGHT }}>
      {HOURS.map((h) => (
        <Text key={h} style={[styles.hourLabel, { top: h * HOUR_HEIGHT - 7 }]}>
          {hourLabel(h)}
        </Text>
      ))}
    </View>
  );
}

export function HourLines() {
  return (
    <View style={[StyleSheet.absoluteFill, styles.noPointer]}>
      {HOURS.map((h) => (
        <View key={h} style={[styles.hourLine, { top: h * HOUR_HEIGHT }]} />
      ))}
    </View>
  );
}

export function NowLine() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);
  return (
    <View style={[styles.now, styles.noPointer, { top: minutesSinceMidnight(now) * PX_PER_MIN - 4 }]}>
      <View style={styles.nowDot} />
      <View style={styles.nowLine} />
    </View>
  );
}

const styles = StyleSheet.create({
  noPointer: { pointerEvents: 'none' },
  hourLabel: { position: 'absolute', right: 8, fontSize: 10, color: colors.textFaint, fontWeight: '600', letterSpacing: 0.3 },
  hourLine: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: colors.hairline },
  now: { position: 'absolute', left: -4, right: 0, flexDirection: 'row', alignItems: 'center', zIndex: 20 },
  nowDot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.nowLine, borderWidth: 2, borderColor: colors.surface },
  nowLine: { flex: 1, height: 2, backgroundColor: colors.nowLine },
});
