// All TTL values in milliseconds. Change these constants and restart the API to tune limits.

export const THROTTLE_GLOBAL_LIMIT = 100;
export const THROTTLE_GLOBAL_TTL = 60_000; // 60 s

export const THROTTLE_CONNECTIONS_LIMIT = 10;
export const THROTTLE_CONNECTIONS_TTL = 10 * 60_000; // 10 min

export const THROTTLE_REPORTS_LIMIT = 5;
export const THROTTLE_REPORTS_TTL = 10 * 60_000; // 10 min

export const THROTTLE_EXCHANGE_LIMIT = 20;
export const THROTTLE_EXCHANGE_TTL = 5 * 60_000; // 5 min
