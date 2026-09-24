import React, { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { type GestureResponderEvent, PanResponder, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop } from 'react-native-svg';
import { colors } from '../theme';
import { hexToHsv, hsvToHex, type Hsv } from '../utils/color';

const WHEEL = 220;
const R = WHEEL / 2;
const SEGMENTS = 72;
const SLIDER_H = 28;
const THUMB = 26;

const clamp = (n: number, min: number, max: number) => Math.min(Math.max(n, min), max);

/** Position of a responder event inside its own view. RN Web may only provide the DOM offsets. */
function localPoint(e: GestureResponderEvent): { x: number; y: number } {
  const n = e.nativeEvent as GestureResponderEvent['nativeEvent'] & { offsetX?: number; offsetY?: number };
  return {
    x: Number.isFinite(n.locationX) ? n.locationX : (n.offsetX ?? 0),
    y: Number.isFinite(n.locationY) ? n.locationY : (n.offsetY ?? 0),
  };
}

/**
 * Tracks a drag from the touch-down point using gesture deltas, which stay reliable when the
 * finger leaves the view (unlike `locationX`, which is relative to whatever is under it).
 */
function useDrag(onPoint: (x: number, y: number) => void) {
  const latest = useRef(onPoint);
  useLayoutEffect(() => {
    latest.current = onPoint;
  });
  const origin = useRef({ x: 0, y: 0 });
  // eslint-disable-next-line react-hooks/refs -- the handlers read refs when a gesture fires, never during render
  const [responder] = useState(() =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderTerminationRequest: () => false,
      onPanResponderGrant: (e) => {
        origin.current = localPoint(e);
        latest.current(origin.current.x, origin.current.y);
      },
      onPanResponderMove: (_, g) => latest.current(origin.current.x + g.dx, origin.current.y + g.dy),
    }),
  );
  return responder;
}

/** Hue/saturation disc plus a brightness slider. Emits `#RRGGBB` on every change. */
export function ColorWheel({ value, onChange }: { value: string; onChange: (hex: string) => void }) {
  // Keep HSV locally: converting through hex loses hue at s=0 / v=0.
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(value));
  const [prevValue, setPrevValue] = useState(value);
  if (value !== prevValue) {
    setPrevValue(value);
    if (value.toUpperCase() !== hsvToHex(hsv)) setHsv(hexToHsv(value));
  }
  const [sliderW, setSliderW] = useState(0);

  const emit = (next: Hsv) => {
    setHsv(next);
    onChange(hsvToHex(next));
  };

  const wheelDrag = useDrag((x, y) => {
    const dx = x - R;
    const dy = y - R;
    const h = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
    emit({ ...hsv, h, s: clamp(Math.hypot(dx, dy) / R, 0, 1) });
  });
  const sliderDrag = useDrag((x) => {
    if (sliderW > 0) emit({ ...hsv, v: clamp((x - THUMB / 2) / (sliderW - THUMB), 0, 1) });
  });

  const wedges = useMemo(
    () =>
      Array.from({ length: SEGMENTS }, (_, i) => {
        const step = 360 / SEGMENTS;
        // Overlap each wedge slightly so anti-aliasing doesn't leave hairline seams.
        const a0 = ((i * step - 0.6) * Math.PI) / 180;
        const a1 = (((i + 1) * step + 0.6) * Math.PI) / 180;
        const d = `M${R},${R} L${R + R * Math.cos(a0)},${R + R * Math.sin(a0)} A${R},${R} 0 0 1 ${R + R * Math.cos(a1)},${R + R * Math.sin(a1)} Z`;
        return <Path key={i} d={d} fill={hsvToHex({ h: i * step + step / 2, s: 1, v: 1 })} />;
      }),
    [],
  );

  const angle = (hsv.h * Math.PI) / 180;
  const knobX = R + hsv.s * R * Math.cos(angle);
  const knobY = R + hsv.s * R * Math.sin(angle);
  const current = hsvToHex(hsv);
  const full = hsvToHex({ ...hsv, v: 1 });

  return (
    <View style={styles.container}>
      <View style={styles.wheel} {...wheelDrag.panHandlers} accessibilityLabel="Color wheel">
        <Svg width={WHEEL} height={WHEEL} pointerEvents="none">
          <Defs>
            <RadialGradient id="whiteCenter" cx={R} cy={R} r={R} gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity="1" />
              <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
            </RadialGradient>
          </Defs>
          {wedges}
          <Circle cx={R} cy={R} r={R} fill="url(#whiteCenter)" />
          <Circle cx={R} cy={R} r={R} fill="#000000" opacity={1 - hsv.v} />
          <Circle cx={knobX} cy={knobY} r={11} fill={current} stroke="#FFFFFF" strokeWidth={3} />
          <Circle cx={knobX} cy={knobY} r={12.5} fill="none" stroke="rgba(0,0,0,0.25)" strokeWidth={1} />
        </Svg>
      </View>

      <View
        style={styles.slider}
        onLayout={(e) => setSliderW(e.nativeEvent.layout.width)}
        {...sliderDrag.panHandlers}
        accessibilityLabel="Brightness"
      >
        {sliderW > 0 ? (
          <Svg width={sliderW} height={THUMB + 4} pointerEvents="none">
            <Defs>
              <LinearGradient id="brightness" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#000000" />
                <Stop offset="1" stopColor={full} />
              </LinearGradient>
            </Defs>
            <Rect x={0} y={(THUMB + 4 - SLIDER_H) / 2} width={sliderW} height={SLIDER_H} rx={SLIDER_H / 2} fill="url(#brightness)" />
            <Circle
              cx={THUMB / 2 + hsv.v * (sliderW - THUMB)}
              cy={(THUMB + 4) / 2}
              r={THUMB / 2 - 1}
              fill={current}
              stroke="#FFFFFF"
              strokeWidth={3}
            />
          </Svg>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: 16, paddingVertical: 4 },
  wheel: { width: WHEEL, height: WHEEL, borderRadius: R, backgroundColor: colors.surfaceAlt },
  slider: { alignSelf: 'stretch', height: THUMB + 4 },
});
