import { Platform, useWindowDimensions } from 'react-native';

/** Browser windows at least this wide get the desktop layout (sidebar, toolbar) instead of the phone one. */
export const DESKTOP_MIN_WIDTH = 900;

export const isWeb = Platform.OS === 'web';

function useDesktopWeb(): boolean {
  return useWindowDimensions().width >= DESKTOP_MIN_WIDTH;
}

/**
 * Whether to use the desktop layout. Always false on phones, where it skips subscribing to window
 * size changes: month pages render a few hundred pills and bars that each ask.
 */
export const useDesktop: () => boolean = isWeb ? useDesktopWeb : () => false;
