import React from 'react';
import Svg, { ClipPath, Defs, G, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

// Mirrors scripts/make-logo.js (the generator for the app icon and splash): keep them in sync.
const TOMATO = '#E2553A';
const TOMATO_DEEP = '#C9432B';
const CREAM = '#FFFCF7';
const INK = '#221D17';

/** The pen-circled date: ~1.1 turns drifting outward so the ends overlap like a hand-drawn circle. */
function circledDatePath(cx: number, cy: number, r: number): string {
  const start = -70;
  const sweep = 385;
  const steps = 96;
  const r0 = r * 0.96;
  const r1 = r * 1.1;
  const points: string[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const a = ((start + sweep * t) * Math.PI) / 180;
    const rr = r0 + (r1 - r0) * t;
    points.push(`${(cx + rr * 1.06 * Math.cos(a)).toFixed(1)} ${(cy + rr * 0.94 * Math.sin(a)).toFixed(1)}`);
  }
  return `M ${points[0]} L ${points.slice(1).join(' L ')}`;
}

const PAGE = { x: 140, y: 190, w: 720, h: 690, r: 120, band: 180 };
const RING = { w: 64, h: 150, y: PAGE.y - 70 };
const DATE_PATH = circledDatePath(500, PAGE.y + PAGE.band + (PAGE.h - PAGE.band) / 2, 138);

/**
 * OpenCal logo. `mark` is the calendar page alone (splash, loading); `tile` puts it on the
 * tomato app-icon square with rounded corners (settings, about).
 */
export function Logo({ size = 64, variant = 'mark' }: { size?: number; variant?: 'mark' | 'tile' }) {
  const tile = variant === 'tile';
  // Same framing as the generated assets: the mark fills 92% (splash) or 86% (icon) of the box.
  const scale = tile ? 0.86 : 0.92;
  const offset = 500 * (1 - scale);
  return (
    <Svg width={size} height={size} viewBox="0 0 1000 1000" accessibilityLabel="OpenCal logo">
      <Defs>
        <LinearGradient id="opencal-bg" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={TOMATO} />
          <Stop offset="1" stopColor={TOMATO_DEEP} />
        </LinearGradient>
        <ClipPath id="opencal-page">
          <Rect x={PAGE.x} y={PAGE.y} width={PAGE.w} height={PAGE.h} rx={PAGE.r} />
        </ClipPath>
      </Defs>
      {tile ? <Rect width={1000} height={1000} rx={224} fill="url(#opencal-bg)" /> : null}
      <G transform={`translate(${offset} ${offset}) scale(${scale})`}>
        <Rect x={PAGE.x} y={PAGE.y} width={PAGE.w} height={PAGE.h} rx={PAGE.r} fill={CREAM} />
        <G clipPath="url(#opencal-page)">
          <Rect x={PAGE.x} y={PAGE.y} width={PAGE.w} height={PAGE.band} fill={INK} />
        </G>
        {[330, 670].map((x) => (
          <Rect key={x} x={x - RING.w / 2} y={RING.y} width={RING.w} height={RING.h} rx={RING.w / 2} fill={CREAM} stroke={INK} strokeWidth={22} />
        ))}
        <Path d={DATE_PATH} fill="none" stroke={TOMATO} strokeWidth={56} strokeLinecap="round" strokeLinejoin="round" />
      </G>
    </Svg>
  );
}
