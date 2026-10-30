/**
 * Keys of the icons an event can carry (stored as `icon:<key>` in `Event.emoji`). Kept apart from
 * `components/Icon.tsx` so the sync server can validate them without the icon library; Icon.tsx
 * checks at compile time that it has exactly these.
 */
export const EVENT_ICON_KEYS = [
  'coffee', 'meal', 'pizza', 'salad', 'drinks', 'cake', 'party', 'gift',
  'work', 'call', 'laptop', 'study', 'school', 'write',
  'gym', 'walk', 'bike', 'swim', 'sport',
  'health', 'doctor', 'meds', 'haircut', 'shopping', 'home', 'pet', 'baby', 'people', 'love',
  'travel', 'drive', 'movie', 'music', 'games', 'money', 'nature', 'morning', 'night', 'star', 'event',
] as const;
