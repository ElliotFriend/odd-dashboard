/**
 * Date utility functions for the dashboard
 * All dates are stored in UTC in the database and converted to browser local time for display
 */

/**
 * Convert a UTC date to the browser's local timezone
 */
export function utcToLocal(utcDate: Date | string): Date {
    const date = typeof utcDate === 'string' ? new Date(utcDate) : utcDate;
    // Dates from the database are already in UTC, but JavaScript Date objects
    // are timezone-aware, so we just return the date as-is since it will
    // automatically display in the browser's local timezone
    return date;
}

/**
 * Format a date for display
 * @param date - Date to format
 * @param options - Intl.DateTimeFormatOptions
 * @returns Formatted date string
 */
export function formatDate(
    date: Date | string | null | undefined,
    options: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
    },
): string {
    if (!date) {
        return 'N/A';
    }

    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) {
        return 'Invalid Date';
    }

    return new Intl.DateTimeFormat(undefined, options).format(dateObj);
}

/**
 * Format a date and time for display
 */
export function formatDateTime(
    date: Date | string | null | undefined,
    options: Intl.DateTimeFormatOptions = {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    },
): string {
    return formatDate(date, options);
}

/**
 * Format a date as a relative time (e.g., "2 hours ago", "3 days ago")
 */
export function formatRelativeTime(date: Date | string | null | undefined): string {
    if (!date) {
        return 'N/A';
    }

    const dateObj = typeof date === 'string' ? new Date(date) : date;
    if (isNaN(dateObj.getTime())) {
        return 'Invalid Date';
    }

    const now = new Date();
    const diffMs = now.getTime() - dateObj.getTime();
    const diffSeconds = Math.floor(diffMs / 1000);
    const diffMinutes = Math.floor(diffSeconds / 60);
    const diffHours = Math.floor(diffMinutes / 60);
    const diffDays = Math.floor(diffHours / 24);
    const diffMonths = Math.floor(diffDays / 30);
    const diffYears = Math.floor(diffDays / 365);

    if (diffSeconds < 60) {
        return 'just now';
    } else if (diffMinutes < 60) {
        return `${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`;
    } else if (diffHours < 24) {
        return `${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`;
    } else if (diffDays < 30) {
        return `${diffDays} day${diffDays !== 1 ? 's' : ''} ago`;
    } else if (diffMonths < 12) {
        return `${diffMonths} month${diffMonths !== 1 ? 's' : ''} ago`;
    } else {
        return `${diffYears} year${diffYears !== 1 ? 's' : ''} ago`;
    }
}

/**
 * Get the start of a day in UTC
 */
export function startOfDay(date: Date = new Date()): Date {
    const d = new Date(date);
    d.setUTCHours(0, 0, 0, 0);
    return d;
}

/**
 * Get the end of a day in UTC
 */
export function endOfDay(date: Date = new Date()): Date {
    const d = new Date(date);
    d.setUTCHours(23, 59, 59, 999);
    return d;
}

/**
 * Format a date range for display
 */
export function formatDateRange(
    startDate: Date | string | null | undefined,
    endDate: Date | string | null | undefined,
): string {
    if (!startDate && !endDate) {
        return 'No date range';
    }

    if (!startDate) {
        return `Until ${formatDate(endDate)}`;
    }

    if (!endDate) {
        return `From ${formatDate(startDate)}`;
    }

    const start = typeof startDate === 'string' ? new Date(startDate) : startDate;
    const end = typeof endDate === 'string' ? new Date(endDate) : endDate;

    // If same day, show once
    if (start.toDateString() === end.toDateString()) {
        return formatDate(start);
    }

    // If same month, show "Jan 1-15, 2024"
    if (start.getFullYear() === end.getFullYear() && start.getMonth() === end.getMonth()) {
        return `${formatDate(start, { month: 'short', day: 'numeric' })} - ${formatDate(end)}`;
    }

    // If same year, show "Jan 1 - Feb 15, 2024"
    if (start.getFullYear() === end.getFullYear()) {
        return `${formatDate(start, { month: 'short', day: 'numeric' })} - ${formatDate(end, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        })}`;
    }

    // Different years, show full dates
    return `${formatDate(start)} - ${formatDate(end)}`;
}
