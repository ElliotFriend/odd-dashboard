// Small display helpers shared across dashboard components.

/** Localized integer, or an em-dash for null/undefined. */
export const fmt = (n: number | null | undefined): string =>
    n == null ? '—' : Number(n).toLocaleString();

/** The value of `key` on the last element of `arr`, or null if empty. */
export const latest = <T, K extends keyof T>(arr: T[] | undefined | null, key: K): T[K] | null =>
    arr && arr.length ? arr[arr.length - 1][key] : null;

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
/** Short weekday ("Mon") for an ISO `yyyy-mm-dd` day, computed in UTC so it never drifts. */
export const weekday = (day: string): string => {
    const [y, m, d] = day.split('-').map(Number);
    return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
};
