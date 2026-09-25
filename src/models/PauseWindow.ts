/**
 * Inclusive range of local calendar dates (`yyyy-MM-dd`) during which recurring
 * occurrences are skipped. The series resumes automatically after `endDate`.
 */
export interface PauseWindow {
  startDate: string;
  endDate: string;
}
