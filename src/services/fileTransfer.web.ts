import * as DocumentPicker from 'expo-document-picker';

export interface PickedFile {
  name: string;
  text: string;
}

/** Web: downloads the file (expo-file-system and local file sharing are native only). */
export async function exportTextFile(fileName: string, content: string, mimeType: string): Promise<void> {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function pickTextFile(): Promise<PickedFile | null> {
  const result = await DocumentPicker.getDocumentAsync({ type: '*/*', base64: false });
  const asset = result.canceled ? null : result.assets[0];
  if (!asset) return null;
  const text = asset.file ? await asset.file.text() : await (await fetch(asset.uri)).text();
  return { name: asset.name, text };
}
