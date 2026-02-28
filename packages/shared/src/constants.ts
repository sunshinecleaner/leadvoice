export const PAGINATION_DEFAULTS = {
  PAGE: 1,
  LIMIT: 20,
  MAX_LIMIT: 100,
} as const;

export const CALL_RETRY = {
  MAX_RETRIES: 3,
  DELAY_MINUTES: 60,
} as const;

export const CALLING_WINDOW = {
  START: "09:00",
  END: "17:00",
  TIMEZONE: "America/New_York",
} as const;

export const US_TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
] as const;
