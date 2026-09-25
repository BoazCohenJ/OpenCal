import type { SavedColor } from '../models/SavedColor';
import { NAMED_PALETTE } from '../theme';

/** Display name for a hex color: a saved name first, then a built-in swatch name, else null. */
export function colorName(hex: string | undefined, saved: SavedColor[]): string | null {
  if (!hex) return null;
  const upper = hex.toUpperCase();
  return saved.find((c) => c.hex === upper)?.name ?? NAMED_PALETTE.find((c) => c.hex === upper)?.name ?? null;
}
