import { addDays, differenceInCalendarDays, format, isSameDay, isSameMonth, startOfDay } from 'date-fns';
import React from 'react';
import { FlexWidget, ListWidget, TextWidget } from 'react-native-android-widget';
import { occurrencesByDay, type Occurrence } from '../services/occurrences';
import { relativeLabel } from '../utils/dates';
import { links, open, widgetFonts, type WidgetColors } from './look';
import {
  AddButton,
  EmptyNote,
  EventCard,
  Frame,
  HEADER_HEIGHT,
  Header,
  MiniPill,
  PADDING,
  RoundButton,
  TodayButton,
} from './parts';

/** Everything a widget draws from, worked out once and drawn in light and dark. */
export interface WidgetProps {
  c: WidgetColors;
  now: Date;
  /** Widget size in dp. */
  width: number;
  height: number;
  occurrences: Occurrence[];
}

const dayHeading = (day: Date, now: Date): string => {
  const n = differenceInCalendarDays(day, now);
  const name = n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : format(day, 'EEEE');
  return `${name} · ${format(day, 'MMM d')}`.toUpperCase();
};

export const SCHEDULE_DAYS = 14;

/** What's coming up over the next two weeks, grouped by day. Things already over today are left out. */
export function ScheduleWidget({ c, now, occurrences }: WidgetProps) {
  const from = startOfDay(now);
  const days = occurrencesByDay(occurrences, from, SCHEDULE_DAYS);
  const items: React.ReactElement[] = [];
  days.forEach((list, i) => {
    const day = addDays(from, i);
    const upcoming = i === 0 ? list.filter((o) => o.end > now) : list;
    if (!upcoming.length) return;
    items.push(
      <FlexWidget key={`h${i}`} style={{ width: 'match_parent', paddingTop: items.length ? 8 : 0, paddingBottom: 4 }} {...open(links.view('day', day))}>
        <TextWidget text={dayHeading(day, now)} style={{ fontSize: 11, fontWeight: '700', letterSpacing: 0.08, color: i === 0 ? c.primary : c.textMuted }} />
      </FlexWidget>,
    );
    for (const o of upcoming) {
      items.push(
        <FlexWidget key={`${i}:${o.key}`} style={{ width: 'match_parent' }}>
          <EventCard c={c} o={o} day={day} />
        </FlexWidget>,
      );
    }
  });
  return (
    <Frame c={c}>
      <Header c={c} eyebrow={format(now, 'EEEE')} title={format(now, 'MMMM d')} uri={links.view('schedule', now)}>
        <AddButton c={c} />
      </Header>
      {items.length ? (
        <ListWidget style={{ width: 'match_parent', height: 'match_parent', marginTop: 6 }}>{items}</ListWidget>
      ) : (
        <EmptyNote c={c} text="Nothing in the next two weeks" />
      )}
    </Frame>
  );
}

/** Today: the date big, then what's still to come. Events already over fold into one line on top. */
export function DayWidget({ c, now, width, occurrences }: WidgetProps) {
  const compact = width < 220;
  const today = occurrencesByDay(occurrences, now, 1)[0] ?? [];
  const done = today.filter((o) => o.end <= now).length;
  const upcoming = today.filter((o) => o.end > now);
  return (
    <Frame c={c}>
      <FlexWidget
        style={{ width: 'match_parent', height: HEADER_HEIGHT, flexDirection: 'row', alignItems: 'center' }}
      >
        <FlexWidget style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }} {...open(links.view('day', now))}>
          <TextWidget text={format(now, 'd')} style={{ fontFamily: widgetFonts.displayBold, fontSize: 38, color: c.text }} />
          <FlexWidget style={{ flexDirection: 'column', marginLeft: 8 }}>
            <TextWidget text={format(now, 'EEEE')} maxLines={1} style={{ fontFamily: widgetFonts.displayItalic, fontSize: 14, color: c.primary }} />
            <TextWidget text={format(now, compact ? 'MMM' : 'MMMM')} maxLines={1} style={{ fontSize: 13, fontWeight: '600', color: c.textMuted }} />
          </FlexWidget>
        </FlexWidget>
        <AddButton c={c} />
      </FlexWidget>
      {done ? (
        <FlexWidget style={{ width: 'match_parent', paddingTop: 4, paddingBottom: 2 }} {...open(links.view('day', now))}>
          <TextWidget
            text={`${done} earlier today`}
            maxLines={1}
            truncate="END"
            style={{ fontSize: 11, fontWeight: '700', letterSpacing: 0.08, color: c.textFaint }}
          />
        </FlexWidget>
      ) : null}
      {upcoming.length ? (
        <ListWidget style={{ width: 'match_parent', height: 'match_parent', marginTop: 4 }}>
          {upcoming.map((o) => (
            <FlexWidget key={o.key} style={{ width: 'match_parent' }}>
              <EventCard c={c} o={o} day={now} />
            </FlexWidget>
          ))}
        </ListWidget>
      ) : (
        <EmptyNote c={c} text={done ? 'Nothing else today' : 'Nothing planned today'} />
      )}
    </Frame>
  );
}

/**
 * How many of `count` events to draw as chips in `room` dp: all of them if they fit, otherwise as
 * many as fit above a "+n" line.
 */
function fitChips(count: number, room: number, chipHeight: number, moreHeight: number): number {
  const all = Math.floor(room / chipHeight);
  return count <= all ? count : Math.max(0, Math.floor((room - moreHeight) / chipHeight));
}

/**
 * Today (when paged away), back and forward. A plain array without nulls: widget trees can't hold
 * fragments, and nulls inside nested arrays aren't skipped.
 */
const pagingButtons =(c: WidgetColors, page: number) => [
  ...(page !== 0 ? [<TodayButton key="today" c={c} />] : []),
  <RoundButton key="prev" c={c} icon="chevron-left" click={{ clickAction: 'PREV' }} label="Previous" />,
  <RoundButton key="next" c={c} icon="chevron-right" click={{ clickAction: 'NEXT' }} label="Next" />,
];

/** Seven day columns with each day's events stacked as chips, like the app's week at a glance. */
export function WeekWidget({ c, now, height, occurrences, weekStart, page }: WidgetProps & { weekStart: Date; page: number }) {
  const days = occurrencesByDay(occurrences, weekStart, 7);
  const weekEnd = addDays(weekStart, 6);
  const title = isSameMonth(weekStart, weekEnd)
    ? `${format(weekStart, 'MMM d')} – ${format(weekEnd, 'd')}`
    : `${format(weekStart, 'MMM d')} – ${format(weekEnd, 'MMM d')}`;
  // Room under the day labels for one-line chips.
  const room = height - PADDING * 2 - HEADER_HEIGHT - 8 - 42;
  return (
    <Frame c={c}>
      <Header c={c} eyebrow={relativeLabel('week', weekStart, now)} title={title} uri={links.view('week', weekStart)}>
        {pagingButtons(c, page)}
      </Header>
      <FlexWidget style={{ flex: 1, width: 'match_parent', flexDirection: 'row', marginTop: 8 }}>
        {days.map((list, i) => {
          const day = addDays(weekStart, i);
          const isToday = isSameDay(day, now);
          const shown = list.slice(0, fitChips(list.length, room, 19, 16));
          const more = list.length - shown.length;
          return (
            <FlexWidget
              key={i}
              {...open(links.view('day', day))}
              style={{
                flex: 1,
                height: 'match_parent',
                flexDirection: 'column',
                alignItems: 'center',
                paddingHorizontal: 2,
                paddingTop: 4,
                borderRadius: 10,
                backgroundColor: isToday ? c.primarySoft : c.surface,
              }}
            >
              <TextWidget text={format(day, 'EEEEE')} style={{ fontSize: 10, fontWeight: '700', color: isToday ? c.primary : c.textMuted }} />
              <TextWidget
                text={format(day, 'd')}
                style={{ fontFamily: widgetFonts.displayBold, fontSize: 17, color: isToday ? c.primary : c.text, marginBottom: 2 }}
              />
              {shown.map((o) => (
                <MiniPill key={o.key} c={c} o={o} />
              ))}
              {more > 0 ? <TextWidget text={`+${more}`} style={{ fontSize: 10, fontWeight: '700', color: c.textMuted, marginTop: 2 }} /> : null}
            </FlexWidget>
          );
        })}
      </FlexWidget>
    </Frame>
  );
}

/** The month grid. Small cells show colored dots per event; roomy ones show event chips. */
export function MonthWidget({
  c,
  now,
  height,
  occurrences,
  month,
  gridStart,
  weeks,
  page,
}: WidgetProps & { month: Date; gridStart: Date; weeks: number; page: number }) {
  const days = occurrencesByDay(occurrences, gridStart, weeks * 7);
  const cellHeight = (height - PADDING * 2 - HEADER_HEIGHT - 8 - 16) / weeks;
  // Room under the day number for one-line chips; cells too short for even one get dots instead.
  const chipRoom = cellHeight - 24;
  const chipsFit = chipRoom >= 14;
  return (
    <Frame c={c}>
      <Header
        c={c}
        eyebrow={page === 0 ? format(month, 'yyyy') : `${relativeLabel('month', month, now)} · ${format(month, 'yyyy')}`}
        title={format(month, 'MMMM')}
        uri={links.view('month', isSameMonth(month, now) ? now : month)}
      >
        {pagingButtons(c, page)}
      </Header>
      <FlexWidget style={{ width: 'match_parent', height: 16, flexDirection: 'row', marginTop: 8 }}>
        {Array.from({ length: 7 }, (_, i) => (
          <FlexWidget key={i} style={{ flex: 1, alignItems: 'center' }}>
            <TextWidget text={format(addDays(gridStart, i), 'EEEEE')} style={{ fontSize: 10, fontWeight: '700', color: c.textFaint }} />
          </FlexWidget>
        ))}
      </FlexWidget>
      {Array.from({ length: weeks }, (_, w) => (
        <FlexWidget key={w} style={{ flex: 1, width: 'match_parent', flexDirection: 'row' }}>
          {Array.from({ length: 7 }, (_, d) => {
            const index = w * 7 + d;
            const day = addDays(gridStart, index);
            const list = days[index] ?? [];
            const inMonth = isSameMonth(day, month);
            const isToday = isSameDay(day, now);
            const shown = chipsFit ? list.slice(0, fitChips(list.length, chipRoom, 14, 11)) : [];
            const more = list.length - shown.length;
            const chips = shown.length > 0;
            return (
              <FlexWidget
                key={d}
                {...open(links.view('day', day))}
                style={{ flex: 1, height: 'match_parent', flexDirection: 'column', alignItems: 'center', paddingTop: 2, paddingHorizontal: 1 }}
              >
                <FlexWidget
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 11,
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: isToday ? c.primary : c.surface,
                  }}
                >
                  <TextWidget
                    text={format(day, 'd')}
                    style={{
                      fontSize: 12,
                      fontWeight: isToday ? '700' : '500',
                      color: isToday ? c.onPrimary : inMonth ? c.text : c.textFaint,
                    }}
                  />
                </FlexWidget>
                {chips ? (
                  [
                    ...shown.map((o) => <MiniPill key={o.key} c={c} o={o} fontSize={8} />),
                    ...(more > 0 ? [<TextWidget key="more" text={`+${more}`} style={{ fontSize: 8, fontWeight: '700', color: c.textMuted }} />] : []),
                  ]
                ) : list.length ? (
                  <FlexWidget style={{ flexDirection: 'row', marginTop: 2 }}>
                    {list.slice(0, 3).map((o) => (
                      <FlexWidget
                        key={o.key}
                        style={{ width: 5, height: 5, borderRadius: 3, marginHorizontal: 1, backgroundColor: inMonth ? c.hex(o.color) : c.faded(o.color) }}
                      />
                    ))}
                  </FlexWidget>
                ) : null}
              </FlexWidget>
            );
          })}
        </FlexWidget>
      ))}
    </Frame>
  );
}
