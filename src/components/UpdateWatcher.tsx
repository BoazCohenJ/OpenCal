import * as Updates from 'expo-updates';
import { useEffect, useRef } from 'react';
import { AppState, Platform } from 'react-native';
import { useToast } from './Toast';

/** Minimum gap between update checks when the app keeps coming back to the foreground. */
const CHECK_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Checks EAS Update when the app starts or returns to the foreground, downloads anything new and
 * offers a one-tap restart. Without it an update would only apply on the next cold start.
 * Inert in development, Expo Go and on web, where expo-updates is disabled.
 */
export function UpdateWatcher() {
  const showToast = useToast();
  const lastCheck = useRef(0);
  const offered = useRef<string | null>(null);

  useEffect(() => {
    if (__DEV__ || Platform.OS === 'web' || !Updates.isEnabled) return;

    const check = async () => {
      if (Date.now() - lastCheck.current < CHECK_INTERVAL_MS) return;
      lastCheck.current = Date.now();
      try {
        const result = await Updates.checkForUpdateAsync();
        if (!result.isAvailable) return;
        const fetched = await Updates.fetchUpdateAsync();
        const id = fetched.manifest && 'id' in fetched.manifest ? String(fetched.manifest.id) : 'new';
        if (!fetched.isNew || offered.current === id) return;
        offered.current = id;
        showToast({
          icon: 'sparkles',
          message: 'A new version of OpenCal is ready',
          actionLabel: 'Restart',
          duration: 15000,
          onAction: () => void Updates.reloadAsync(),
        });
      } catch (error) {
        // Offline or server hiccup: try again on the next foreground.
        lastCheck.current = 0;
        console.warn('Update check failed', error);
      }
    };

    void check();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void check();
    });
    return () => sub.remove();
  }, [showToast]);

  return null;
}
