/** Colors every event whose title contains `keyword` (a "Break" rule turns all breaks yellow). */
export interface ColorRule {
  id: string;
  /** Matched anywhere in the title, ignoring case. */
  keyword: string;
  /** `#RRGGBB`, upper case. */
  color: string;
}
