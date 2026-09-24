export const DEFAULT_EVENT_COLOR = '#4F6BED';

/** Accepts `abc`, `#abc`, `aabbcc`, `#AABBCC`. Returns `#AABBCC` or null. */
export function normalizeHex(input: string, allowShort = true): string | null {
  let v = input.trim();
  if (!v) return null;
  if (!v.startsWith('#')) v = `#${v}`;
  if (allowShort && /^#[0-9a-f]{3}$/i.test(v)) {
    v = `#${v.slice(1).split('').map((c) => c + c).join('')}`;
  }
  return /^#[0-9a-f]{6}$/i.test(v) ? v.toUpperCase() : null;
}

function toRgb(hex: string): [number, number, number] {
  const n = normalizeHex(hex) ?? DEFAULT_EVENT_COLOR;
  return [parseInt(n.slice(1, 3), 16), parseInt(n.slice(3, 5), 16), parseInt(n.slice(5, 7), 16)];
}

export function mix(hex: string, other: string, amount: number): string {
  const [r1, g1, b1] = toRgb(hex);
  const [r2, g2, b2] = toRgb(other);
  const c = [r1 + (r2 - r1) * amount, g1 + (g2 - g1) * amount, b1 + (b2 - b1) * amount];
  return `#${c.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}

export const softBg = (hex: string): string => mix(hex, '#FFFCF7', 0.8);
export const deepText = (hex: string): string => mix(hex, '#1A1208', 0.5);

export function readableOn(hex: string): string {
  const [r, g, b] = toRgb(hex);
  return 0.299 * r + 0.587 * g + 0.114 * b > 165 ? '#221D17' : '#FFFCF7';
}

export interface Hsv {
  /** 0–360 */
  h: number;
  /** 0–1 */
  s: number;
  /** 0–1 */
  v: number;
}

export function hexToHsv(hex: string): Hsv {
  const [r, g, b] = toRgb(hex).map((c) => c / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const d = max - Math.min(r, g, b);
  let h = 0;
  if (d) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
  }
  return { h, s: max ? d / max : 0, v: max };
}

export function hsvToHex({ h, s, v }: Hsv): string {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return `#${[r, g, b].map((n) => Math.round((n + m) * 255).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
}
