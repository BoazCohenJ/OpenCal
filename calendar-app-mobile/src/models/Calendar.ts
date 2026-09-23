import type { PauseWindow } from './PauseWindow';

export interface Calendar {
  id: string;
  name: string;
  /** Default hex color inherited by events without an override. */
  color: string;
  sortOrder: number;
  /** Pauses every recurring event in this calendar. Composes with per-event pauses. */
  pauseWindows: PauseWindow[];
}
