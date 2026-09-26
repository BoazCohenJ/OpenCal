import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export interface PickedFile {
  name: string;
  text: string;
}

/** Writes `content` to a temporary file and opens the share sheet (save to Files, Drive, email…). */
export async function exportTextFile(fileName: string, content: string, mimeType: string): Promise<void> {
  const file = new File(Paths.cache, fileName);
  if (file.exists) file.delete();
  file.create();
  file.write(content);
  if (!(await Sharing.isAvailableAsync())) throw new Error('Sharing is not available on this device.');
  await Sharing.shareAsync(file.uri, { mimeType, dialogTitle: fileName, UTI: mimeType === 'text/calendar' ? 'public.calendar-event' : 'public.json' });
}

/** Lets the user pick a file and returns its text, or null when they cancel. */
export async function pickTextFile(): Promise<PickedFile | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
  const asset = result.canceled ? null : result.assets[0];
  if (!asset) return null;
  return { name: asset.name, text: await new File(asset.uri).text() };
}
