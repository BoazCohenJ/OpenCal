import { format } from 'date-fns';
import type { ColorProp } from 'react-native-android-widget';
import { birthdayIdOf } from '../services/birthdays';
import type { Occurrence } from '../services/occurrences';
import { palettes, type ColorScheme } from '../theme';
import { mix } from '../utils/color';
import { dayKey } from '../utils/dates';

/** The app palette for one scheme, plus event tints (the app's softBg/deepText, but for a given scheme). */
export function widgetColors(scheme: ColorScheme) {
  const p = palettes[scheme];
  const c = (v: string) => v as ColorProp;
  return {
    scheme,
    bg: c(p.bg),
    surface: c(p.surface),
    surfaceAlt: c(p.surfaceAlt),
    border: c(p.border),
    hairline: c(p.hairline),
    text: c(p.text),
    textMuted: c(p.textMuted),
    textFaint: c(p.textFaint),
    primary: c(p.primary),
    primarySoft: c(p.primarySoft),
    onPrimary: c(p.onPrimary),
    weekend: c(p.weekend),
    soft: (hex: string) => c(scheme === 'dark' ? mix(hex, '#1F1B16', 0.7) : mix(hex, '#FFFCF7', 0.8)),
    deep: (hex: string) => c(scheme === 'dark' ? mix(hex, '#FFF6EA', 0.55) : mix(hex, '#1A1208', 0.5)),
    /** An event color pushed toward the paper, for things that already happened. */
    faded: (hex: string) => c(scheme === 'dark' ? mix(hex, '#1F1B16', 0.82) : mix(hex, '#FFFCF7', 0.9)),
    hex: (v: string) => c(v),
  };
}

export type WidgetColors = ReturnType<typeof widgetColors>;

/** Font files bundled for widgets by the config plugin (app.json → react-native-android-widget → fonts). */
export const widgetFonts = {
  display: 'Fraunces_600SemiBold',
  displayBold: 'Fraunces_800ExtraBold',
  displayItalic: 'Fraunces_500Medium_Italic',
};

/** Lucide paths, drawn as SVG so they stay crisp at any widget size. */
const ICON_PATHS = {
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  'chevron-left': '<path d="m15 18-6-6 6-6"/>',
  'chevron-right': '<path d="m9 18 6-6-6-6"/>',
};

export const iconSvg = (name: keyof typeof ICON_PATHS, color: string, strokeWidth = 2.5): string =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">${ICON_PATHS[name]}</svg>`;

/** Deep links the app handles (see `linking` in App.tsx). */
export const links = {
  view: (mode: 'schedule' | 'day' | 'week' | 'month', date: Date) => `opencal://calendar?mode=${mode}&date=${dayKey(date)}`,
  quickAdd: () => 'opencal://quick-add',
  occurrence: (o: Occurrence) => {
    const birthdayId = birthdayIdOf(o.event);
    return birthdayId ? `opencal://birthday/${encodeURIComponent(birthdayId)}` : `opencal://event/${encodeURIComponent(o.event.id)}?occurrenceStart=${encodeURIComponent(o.start.toISOString())}`;
  },
};

export const open = (uri: string) => ({ clickAction: 'OPEN_URI', clickActionData: { uri } });

/** "9 AM", "9:30 AM". */
export const shortTime = (d: Date): string => format(d, d.getMinutes() === 0 ? 'h a' : 'h:mm a');
