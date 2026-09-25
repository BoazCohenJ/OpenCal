import { format } from 'date-fns';
import * as Updates from 'expo-updates';
import { Platform } from 'react-native';
import appConfig from '../../app.json';

/** Version of the installed build (also its runtime version: updates only target the same version). */
export const APP_VERSION: string = Updates.runtimeVersion || appConfig.expo.version;

/** "Updated Sep 25, 3:40 PM · preview", or undefined when not running an EAS build. */
export function updateInfo(): string | undefined {
  if (Platform.OS === 'web' || !Updates.isEnabled || !Updates.createdAt) return undefined;
  const source = Updates.isEmbeddedLaunch ? 'Installed' : 'Updated';
  return [`${source} ${format(Updates.createdAt, 'MMM d, h:mm a')}`, Updates.channel].filter(Boolean).join(' · ');
}
