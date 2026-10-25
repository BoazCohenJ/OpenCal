import { format } from 'date-fns';
import Constants from 'expo-constants';
import * as Updates from 'expo-updates';
import { Platform } from 'react-native';

/** Version of the installed build (also its runtime version: updates only target the same version). */
export const APP_VERSION: string = Updates.runtimeVersion || Constants.expoConfig?.version || '';

/** "Updated Sep 25, 3:40 PM · preview", or undefined when not running an EAS build. */
export function updateInfo(): string | undefined {
  if (Platform.OS === 'web' || !Updates.isEnabled || !Updates.createdAt) return undefined;
  const source = Updates.isEmbeddedLaunch ? 'Installed' : 'Updated';
  return [`${source} ${format(Updates.createdAt, 'MMM d, h:mm a')}`, Updates.channel].filter(Boolean).join(' · ');
}
