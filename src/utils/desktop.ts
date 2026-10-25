import { Platform, useWindowDimensions } from 'react-native';

/** Browser windows at least this wide get the desktop layout (sidebar, toolbar) instead of the phone one. */
export const DESKTOP_MIN_WIDTH = 900;

export const isWeb = Platform.OS === 'web';

export function useDesktop(): boolean {
  const { width } = useWindowDimensions();
  return isWeb && width >= DESKTOP_MIN_WIDTH;
}
