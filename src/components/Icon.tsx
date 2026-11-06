// Each icon is imported from its own module: importing from the package root would bundle all
// ~3,700 lucide icons (about 1.6 MB of JS), since Metro doesn't tree-shake.
import ArrowDown from 'lucide-react-native/icons/arrow-down';
import ArrowUp from 'lucide-react-native/icons/arrow-up';
import Baby from 'lucide-react-native/icons/baby';
import Beer from 'lucide-react-native/icons/beer';
import Bell from 'lucide-react-native/icons/bell';
import BellOff from 'lucide-react-native/icons/bell-off';
import BellRing from 'lucide-react-native/icons/bell-ring';
import Bike from 'lucide-react-native/icons/bike';
import BookOpen from 'lucide-react-native/icons/book-open';
import Briefcase from 'lucide-react-native/icons/briefcase';
import Calendar1 from 'lucide-react-native/icons/calendar-1';
import Cake from 'lucide-react-native/icons/cake';
import CalendarDays from 'lucide-react-native/icons/calendar-days';
import Car from 'lucide-react-native/icons/car';
import Check from 'lucide-react-native/icons/check';
import ChevronDown from 'lucide-react-native/icons/chevron-down';
import ChevronLeft from 'lucide-react-native/icons/chevron-left';
import ChevronRight from 'lucide-react-native/icons/chevron-right';
import ChevronUp from 'lucide-react-native/icons/chevron-up';
import Clock from 'lucide-react-native/icons/clock';
import Coffee from 'lucide-react-native/icons/coffee';
import Dog from 'lucide-react-native/icons/dog';
import Dumbbell from 'lucide-react-native/icons/dumbbell';
import Film from 'lucide-react-native/icons/film';
import Footprints from 'lucide-react-native/icons/footprints';
import Gamepad2 from 'lucide-react-native/icons/gamepad-2';
import Gift from 'lucide-react-native/icons/gift';
import GraduationCap from 'lucide-react-native/icons/graduation-cap';
import Heart from 'lucide-react-native/icons/heart';
import HeartPulse from 'lucide-react-native/icons/heart-pulse';
import House from 'lucide-react-native/icons/house';
import Info from 'lucide-react-native/icons/info';
import Laptop from 'lucide-react-native/icons/laptop';
import Leaf from 'lucide-react-native/icons/leaf';
import List from 'lucide-react-native/icons/list';
import MapPin from 'lucide-react-native/icons/map-pin';
import Minus from 'lucide-react-native/icons/minus';
import Moon from 'lucide-react-native/icons/moon';
import Music from 'lucide-react-native/icons/music';
import PartyPopper from 'lucide-react-native/icons/party-popper';
import Pause from 'lucide-react-native/icons/pause';
import Pencil from 'lucide-react-native/icons/pencil';
import Phone from 'lucide-react-native/icons/phone';
import Pill from 'lucide-react-native/icons/pill';
import Pipette from 'lucide-react-native/icons/pipette';
import Pizza from 'lucide-react-native/icons/pizza';
import Plane from 'lucide-react-native/icons/plane';
import Plus from 'lucide-react-native/icons/plus';
import Repeat from 'lucide-react-native/icons/repeat';
import Salad from 'lucide-react-native/icons/salad';
import Scissors from 'lucide-react-native/icons/scissors';
import Search from 'lucide-react-native/icons/search';
import Settings from 'lucide-react-native/icons/settings';
import ShoppingCart from 'lucide-react-native/icons/shopping-cart';
import Smile from 'lucide-react-native/icons/face-slightly-smiling';
import Sparkles from 'lucide-react-native/icons/sparkles';
import Stamp from 'lucide-react-native/icons/stamp';
import Star from 'lucide-react-native/icons/star';
import Stethoscope from 'lucide-react-native/icons/stethoscope';
import Sun from 'lucide-react-native/icons/sun';
import Trophy from 'lucide-react-native/icons/trophy';
import Type from 'lucide-react-native/icons/type';
import Users from 'lucide-react-native/icons/users';
import Utensils from 'lucide-react-native/icons/utensils';
import Wallet from 'lucide-react-native/icons/wallet';
import Waves from 'lucide-react-native/icons/waves-horizontal';
import X from 'lucide-react-native/icons/x';
import Zap from 'lucide-react-native/icons/zap';
import type { LucideIcon } from 'lucide-react-native';
import React from 'react';
import { Text } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { useTheme } from '../theme';
import type { EVENT_ICON_KEYS } from '../utils/eventIconKeys';

type IconProps = { size?: number; color?: string; strokeWidth?: number };
type IconComponent = LucideIcon | ((props: IconProps) => React.ReactElement);

/** Calendar frame with a single row of days, to sit beside Calendar1 (day) and CalendarDays (month). */
function CalendarWeek({ size = 24, color = 'currentColor', strokeWidth = 2 }: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M8 2v3" />
      <Path d="M16 2v3" />
      <Rect x="3" y="3" width="18" height="18" rx="2" />
      <Path d="M3 9h18" />
      <Path d="M8 15h.01" />
      <Path d="M12 15h.01" />
      <Path d="M16 15h.01" />
    </Svg>
  );
}

/** Interface icons. */
const UI_ICONS = {
  'arrow-down': ArrowDown,
  'arrow-up': ArrowUp,
  bell: Bell,
  cake: Cake,
  'bell-off': BellOff,
  'bell-ring': BellRing,
  calendar: CalendarDays,
  check: Check,
  'chevron-down': ChevronDown,
  'chevron-left': ChevronLeft,
  'chevron-right': ChevronRight,
  'chevron-up': ChevronUp,
  clock: Clock,
  info: Info,
  smile: Smile,
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
  'view-schedule': List,
  'view-day': Calendar1,
  'view-week': CalendarWeek,
  'view-month': CalendarDays,
  x: X,
  zap: Zap,
} satisfies Record<string, IconComponent>;

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
} satisfies Record<(typeof EVENT_ICON_KEYS)[number], LucideIcon>;

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
 * emoji values saved before icons existed. Renders nothing when unset.
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
