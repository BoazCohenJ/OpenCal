/** A color the user saved by name in the color picker. */
export interface SavedColor {
  id: string;
  name: string;
  /** `#RRGGBB`, upper case. */
  hex: string;
}
