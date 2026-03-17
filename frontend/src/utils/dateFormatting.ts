/** Weekday short + date + time (e.g. "Mi., 04.06.2025, 19:00 Uhr") */
export const formatDateTimeShort = (d: string) =>
  new Intl.DateTimeFormat('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(d));

/** Weekday long + date + time (e.g. "Mittwoch, 04. Juni 2025, 19:00 Uhr") */
export const formatDateTimeLong = (d: string) =>
  new Intl.DateTimeFormat('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(d));

/** Weekday long + date only (e.g. "Mittwoch, 04. Juni 2025") */
export const formatDateLong = (d: string) =>
  new Intl.DateTimeFormat('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(d));

/** Weekday short + date only (e.g. "Mi., 04.06.2025") */
export const formatDateMedium = (d: string) =>
  new Intl.DateTimeFormat('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(d));

/** Numeric date only (e.g. "04.06.2025") */
export const formatDateNumeric = (d: string) =>
  new Intl.DateTimeFormat('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(d));
