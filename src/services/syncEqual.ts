/** Object key order and omitted optional properties do not change a sync record. */
export function syncEqual(a: unknown, b: unknown): boolean {
  const normalize = (v: unknown): unknown => Array.isArray(v) ? v.map(normalize) : v && typeof v === 'object'
    ? Object.fromEntries(Object.entries(v).filter(([, x]) => x !== undefined).sort(([x], [y]) => x.localeCompare(y)).map(([k, x]) => [k, normalize(x)])) : v;
  return JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
}
