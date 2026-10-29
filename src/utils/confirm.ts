export interface AppPrompt {
  id: number;
  title: string;
  message?: string;
  confirmLabel: string;
  destructive: boolean;
  cancelable: boolean;
  resolve: (confirmed: boolean) => void;
}
let sequence = 0;
let queue: AppPrompt[] = [];
const listeners = new Set<() => void>();
const changed = () => listeners.forEach((listener) => listener());
export const getPrompt = (): AppPrompt | null => queue[0] ?? null;
export function subscribePrompts(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
export function answerPrompt(id: number, confirmed: boolean): void {
  if (queue[0]?.id !== id) return;
  const prompt = queue[0];
  queue = queue.slice(1);
  changed();
  prompt.resolve(confirmed);
}
function enqueue(title: string, message: string | undefined, confirmLabel: string, destructive: boolean, cancelable: boolean): Promise<boolean> {
  return new Promise((resolve) => {
    queue = [...queue, { id: ++sequence, title, message, confirmLabel, destructive, cancelable, resolve }];
    changed();
  });
}

export function confirmAsync(
  title: string,
  message: string,
  confirmLabel = 'OK',
  destructive = false,
): Promise<boolean> {
  return enqueue(title, message, confirmLabel, destructive, true);
}

export function notify(title: string, message?: string): void {
  void enqueue(title, message, 'Got it', false, false);
}
