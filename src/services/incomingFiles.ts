/*
 * Files other apps open with OpenCal (an invite.ics from Gmail, an .ics or .eml from Files). Android
 * hands them over as the launch link, a content:// or file:// URI, which App.tsx keeps away from
 * navigation linking and passes here; InviteWatcher picks them up once the app is ready.
 */

type Listener = (uri: string) => void;

const listeners = new Set<Listener>();
const queued: string[] = [];

export const isFileLink = (url: string): boolean => /^(content|file):\/\//i.test(url);

export function deliverFile(uri: string): void {
  if (listeners.size) listeners.forEach((l) => l(uri));
  else queued.push(uri);
}

/** Files that arrive from now on, plus any that came before anyone was listening. */
export function onIncomingFile(listener: Listener): () => void {
  listeners.add(listener);
  queued.splice(0).forEach(listener);
  return () => {
    listeners.delete(listener);
  };
}
