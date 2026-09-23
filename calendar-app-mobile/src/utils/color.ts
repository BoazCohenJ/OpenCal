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

export const softBg = (hex: string): string => mix(hex, '#FFFFFF', 0.82);
export const deepText = (hex: string): string => mix(hex, '#000000', 0.45);

export function readableOn(hex: string): string {
  const [r, g, b] = toRgb(hex);
  return 0.299 * r + 0.587 * g + 0.114 * b > 165 ? '#1B1F2A' : '#FFFFFF';
}
