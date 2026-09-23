/** Collision-resistant local id. Avoids uuid, which needs crypto.getRandomValues (missing on Hermes). */
export const newId = (): string =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}${Math.random().toString(36).slice(2, 6)}`;
