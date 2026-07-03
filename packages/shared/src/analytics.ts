export const AnalyticsEvent = {
  STORE_CHECKIN: 'store_checkin',
  EVENT_RSVP_CREATED: 'event_rsvp_created',
  EVENT_RSVP_CANCELLED: 'event_rsvp_cancelled',
  BADGE_EARNED: 'badge_earned',
  GAME_CONFIRMED: 'game_confirmed',
} as const;

export type AnalyticsEventName = (typeof AnalyticsEvent)[keyof typeof AnalyticsEvent];
