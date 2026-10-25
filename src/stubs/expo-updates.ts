// Stand-in for expo-updates in the F-Droid variant, which never loads remote code. Mirrors only the
// parts of the API the app uses; metro.config.js resolves `expo-updates` here when OPENCAL_VARIANT=fdroid.
export const isEnabled = false;
export const runtimeVersion: string | null = null;
export const createdAt: Date | null = null;
export const isEmbeddedLaunch = true;
export const channel: string | null = null;

export async function checkForUpdateAsync(): Promise<{ isAvailable: boolean }> {
  return { isAvailable: false };
}

export async function fetchUpdateAsync(): Promise<{ isNew: boolean; manifest?: { id?: string } }> {
  return { isNew: false };
}

export async function reloadAsync(): Promise<void> {}
