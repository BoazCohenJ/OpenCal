import { isSameDay, startOfDay } from 'date-fns';
import React from 'react';
import { FlexWidget, SvgWidget, TextWidget } from 'react-native-android-widget';
import type { Occurrence } from '../services/occurrences';
import { iconSvg, links, open, shortTime, widgetFonts, type WidgetColors } from './look';

export const PADDING = 14;
/** Height the header takes, for widgets that size their rows to what's left. */
export const HEADER_HEIGHT = 50;

/** The rounded card every widget sits on. */
export function Frame({ c, children }: { c: WidgetColors; children: React.ReactNode }) {
  return (
    <FlexWidget
      style={{
        height: 'match_parent',
        width: 'match_parent',
        flexDirection: 'column',
        backgroundColor: c.surface,
        borderRadius: 24,
        padding: PADDING,
      }}
    >
      {children}
    </FlexWidget>
  );
}

/** Eyebrow and title like the app's header; tapping them opens the app there. Buttons sit on the right. */
export function Header({
  c,
  eyebrow,
  title,
  uri,
  children,
}: {
  c: WidgetColors;
  eyebrow: string;
  title: string;
  uri: string;
  children?: React.ReactNode;
}) {
  return (
    <FlexWidget style={{ width: 'match_parent', height: HEADER_HEIGHT, flexDirection: 'row', alignItems: 'center' }}>
      <FlexWidget style={{ flex: 1, flexDirection: 'column', justifyContent: 'center' }} {...open(uri)}>
        <TextWidget
          text={eyebrow}
          maxLines={1}
          truncate="END"
          style={{ fontFamily: widgetFonts.displayItalic, fontSize: 13, color: c.primary }}
        />
        <TextWidget
          text={title}
          maxLines={1}
          truncate="END"
          style={{ fontFamily: widgetFonts.displayBold, fontSize: 23, color: c.text }}
        />
      </FlexWidget>
      {children}
    </FlexWidget>
  );
}

/** Round icon button: the + (filled, opens Quick Add) or a paging arrow. */
export function RoundButton({
  c,
  icon,
  filled = false,
  click,
  label,
}: {
  c: WidgetColors;
  icon: 'plus' | 'chevron-left' | 'chevron-right';
  filled?: boolean;
  click: { clickAction: string; clickActionData?: Record<string, unknown> };
  label: string;
}) {
  const size = filled ? 34 : 30;
  return (
    <FlexWidget
      {...click}
      accessibilityLabel={label}
      style={{
        width: size,
        height: size,
        marginLeft: 6,
        borderRadius: size / 2,
        backgroundColor: filled ? c.primary : c.surfaceAlt,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <SvgWidget svg={iconSvg(icon, filled ? c.onPrimary : c.text)} style={{ width: filled ? 20 : 17, height: filled ? 20 : 17 }} />
    </FlexWidget>
  );
}

export const AddButton = ({ c }: { c: WidgetColors }) => (
  <RoundButton c={c} icon="plus" filled click={open(links.quickAdd())} label="New event" />
);

/** "Today" pill shown while a Week or Month widget is paged away from today. */
export function TodayButton({ c }: { c: WidgetColors }) {
  return (
    <FlexWidget
      clickAction="TODAY"
      accessibilityLabel="Back to today"
      style={{ height: 30, paddingHorizontal: 10, marginLeft: 6, borderRadius: 15, backgroundColor: c.primarySoft, justifyContent: 'center' }}
    >
      <TextWidget text="Today" style={{ fontSize: 12, fontWeight: '700', color: c.primary }} />
    </FlexWidget>
  );
}

/** "9 AM – 10:30 AM", "All day", or "Until 3 PM" for something that started on an earlier day. */
export function timeLabel(o: Occurrence, day: Date): string {
  const dayStart = startOfDay(day);
  if (o.event.isAllDay) return 'All day';
  const startsToday = o.start >= dayStart;
  const endsToday = isSameDay(o.end, day) && o.end > dayStart;
  if (startsToday && endsToday) return `${shortTime(o.start)} – ${shortTime(o.end)}`;
  if (startsToday) return `From ${shortTime(o.start)}`;
  if (endsToday) return `Until ${shortTime(o.end)}`;
  return 'All day';
}

/** One event as a tinted card (the app's event pill), tapping opens it. */
export function EventCard({ c, o, day }: { c: WidgetColors; o: Occurrence; day: Date }) {
  const detail = [timeLabel(o, day), o.event.location].filter(Boolean).join(' · ');
  return (
    <FlexWidget
      {...open(links.occurrence(o))}
      style={{
        width: 'match_parent',
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: c.soft(o.color),
        borderRadius: 12,
        paddingVertical: 7,
        paddingLeft: 8,
        paddingRight: 10,
        marginBottom: 5,
      }}
    >
      <FlexWidget style={{ width: 4, height: 30, borderRadius: 2, backgroundColor: c.hex(o.color) }} />
      <FlexWidget style={{ flex: 1, flexDirection: 'column', marginLeft: 8 }}>
        <TextWidget
          text={o.event.title || 'Untitled'}
          maxLines={1}
          truncate="END"
          style={{ fontSize: 14, fontWeight: '600', color: c.deep(o.color) }}
        />
        <TextWidget text={detail} maxLines={1} truncate="END" style={{ fontSize: 12, color: c.textMuted }} />
      </FlexWidget>
    </FlexWidget>
  );
}

/** Small single-line event chip for the Week and Month grids. */
export function MiniPill({ c, o, fontSize = 10 }: { c: WidgetColors; o: Occurrence; fontSize?: number }) {
  return (
    <FlexWidget
      style={{
        width: 'match_parent',
        backgroundColor: c.soft(o.color),
        borderRadius: 5,
        paddingHorizontal: 3,
        paddingVertical: 1,
        marginTop: 2,
      }}
    >
      <TextWidget
        text={o.event.title || 'Untitled'}
        maxLines={1}
        truncate="END"
        style={{ fontSize, fontWeight: '600', color: c.deep(o.color) }}
      />
    </FlexWidget>
  );
}

export function EmptyNote({ c, text }: { c: WidgetColors; text: string }) {
  return (
    <FlexWidget style={{ flex: 1, width: 'match_parent', alignItems: 'center', justifyContent: 'center' }} {...open(links.quickAdd())}>
      <TextWidget text={text} style={{ fontFamily: widgetFonts.displayItalic, fontSize: 15, color: c.textMuted }} />
      <TextWidget text="Tap to add something" style={{ fontSize: 12, color: c.textFaint, marginTop: 2 }} />
    </FlexWidget>
  );
}
