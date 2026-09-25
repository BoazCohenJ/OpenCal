import {
  ArrowDown,
  ArrowUp,
  Baby,
  Beer,
  Bell,
  BellOff,
  BellRing,
  Bike,
  BookOpen,
  Briefcase,
  Cake,
  CalendarDays,
  Car,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Clock,
  Coffee,
  Dog,
  Dumbbell,
  Film,
  Footprints,
  Gamepad2,
  Gift,
  GraduationCap,
  Heart,
  HeartPulse,
  House,
  Laptop,
  Leaf,
  type LucideIcon,
  MapPin,
  Minus,
  Moon,
  Music,
  PartyPopper,
  Pause,
  Pencil,
  Phone,
  Pill,
  Pipette,
  Pizza,
  Plane,
  Plus,
  Repeat,
  Salad,
  Scissors,
  Search,
  Settings,
  ShoppingCart,
  Sparkles,
  Stamp,
  Star,
  Stethoscope,
  Sun,
  Trophy,
  Type,
  Users,
  Utensils,
  Wallet,
  Waves,
  X,
} from 'lucide-react-native';
import React from 'react';
import { Text } from 'react-native';
import { useTheme } from '../theme';

/** Interface icons. */
const UI_ICONS = {
  'arrow-down': ArrowDown,
  'arrow-up': ArrowUp,
  bell: Bell,
  'bell-off': BellOff,
  'bell-ring': BellRing,
  calendar: CalendarDays,
  check: Check,
  'chevron-down': ChevronDown,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  'chevron-up': ChevronUp,
  clock: Clock,
  'map-pin': MapPin,
  minus: Minus,
  moon: Moon,
  pause: Pause,
  pipette: Pipette,
  plus: Plus,
  repeat: Repeat,
  search: Search,
  settings: Settings,
  sparkles: Sparkles,
  stamp: Stamp,
  title: Type,
  x: X,
} satisfies Record<string, LucideIcon>;

/**
 * Icons users can attach to events and stamps. The key is what gets stored in the
 * `emoji` field (as `icon:<key>`), so keys must stay stable once shipped.
 */
export const EVENT_ICONS = {
  coffee: Coffee,
  meal: Utensils,
  pizza: Pizza,
  salad: Salad,
  drinks: Beer,
  cake: Cake,
  party: PartyPopper,
  gift: Gift,
  work: Briefcase,
  call: Phone,
  laptop: Laptop,
  study: BookOpen,
  school: GraduationCap,
  write: Pencil,
  gym: Dumbbell,
  walk: Footprints,
  bike: Bike,
  swim: Waves,
  sport: Trophy,
  health: HeartPulse,
  doctor: Stethoscope,
  meds: Pill,
  haircut: Scissors,
  shopping: ShoppingCart,
  home: House,
  pet: Dog,
  baby: Baby,
  people: Users,
  love: Heart,
  travel: Plane,
  drive: Car,
  movie: Film,
  music: Music,
  games: Gamepad2,
  money: Wallet,
  nature: Leaf,
  morning: Sun,
  night: Moon,
  star: Star,
  event: CalendarDays,
} satisfies Record<string, LucideIcon>;

export type IconName = keyof typeof UI_ICONS;
export type EventIconKey = keyof typeof EVENT_ICONS;

export function Icon({
  name,
  size = 20,
  color,
  strokeWidth = 2,
}: {
  name: IconName;
  size?: number;
  color?: string;
  strokeWidth?: number;
}) {
  const { colors } = useTheme();
  const Component = UI_ICONS[name];
  return <Component size={size} color={color ?? colors.text} strokeWidth={strokeWidth} />;
}

const ICON_PREFIX = 'icon:';

export const toIconValue = (key: EventIconKey): string => `${ICON_PREFIX}${key}`;

export function eventIconKey(value?: string): EventIconKey | null {
  if (!value?.startsWith(ICON_PREFIX)) return null;
  const key = value.slice(ICON_PREFIX.length);
  return key in EVENT_ICONS ? (key as EventIconKey) : null;
}

/**
 * Renders an event/stamp glyph: an SVG icon for `icon:<key>` values, or the raw text for
 * legacy emoji values saved before icons existed. Renders nothing when unset.
 */
export function EventGlyph({
  value,
  size = 16,
  color,
  fallback,
}: {
  value?: string;
  size?: number;
  color?: string;
  fallback?: EventIconKey;
}) {
  const { colors } = useTheme();
  const key = eventIconKey(value) ?? (value ? null : fallback ?? null);
  if (key) {
    const Component = EVENT_ICONS[key];
    return <Component size={size} color={color ?? colors.text} strokeWidth={2} />;
  }
  if (!value) return null;
  return <Text style={{ fontSize: size * 0.95, lineHeight: size * 1.2 }}>{value}</Text>;
}
