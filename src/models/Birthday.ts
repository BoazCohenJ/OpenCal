/** Someone's birthday, shown every year as an all-day event on the calendar. */
export interface Birthday {
  id: string;
  name: string;
  /** Date of birth as `yyyy-MM-dd`. */
  birthDate: string;
}
