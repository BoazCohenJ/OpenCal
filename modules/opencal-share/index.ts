import { requireOptionalNativeModule } from 'expo';
import { Platform } from 'react-native';

/** Something another app shared to OpenCal: a file read to text, or plain text. */
export interface SharedItem {
  isFile: boolean;
  text?: string;
  /** The shared file's name, when the sender gives one. */
  name?: string;
  /** EXTRA_SUBJECT, e.g. an email's subject line. */
  subject?: string;
  type?: string;
  /** Set when a shared file couldn't be read. */
  error?: string;
}

interface Native {
  takeLaunchShare(): Promise<SharedItem | null>;
  addListener(event: 'onShare', listener: (item: SharedItem) => void): { remove(): void };
}

// Android's Share menu only; other platforms have no native module.
const native = Platform.OS === 'android' ? requireOptionalNativeModule<Native>('OpenCalShare') : null;

/** What the app was launched to receive, once (null after that, or when it wasn't a share). */
export const takeLaunchShare = async (): Promise<SharedItem | null> => (native ? native.takeLaunchShare() : null);

/** Shares that arrive while the app is running. */
export function addShareListener(listener: (item: SharedItem) => void): () => void {
  const sub = native?.addListener('onShare', listener);
  return () => sub?.remove();
}
