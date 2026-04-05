import type { BusinessHoursSchedule } from '../types';

export const businessDayLabels = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const commonTimeZones = [
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'America/Phoenix',
  'America/Anchorage',
  'Pacific/Honolulu',
  'Europe/London',
  'Europe/Paris',
  'UTC',
];

export const browserTimeZoneId = getBrowserTimeZoneId();

export function createDefaultBusinessHoursSchedule(): BusinessHoursSchedule {
  return {
    timeZoneId: browserTimeZoneId,
    days: businessDayLabels.map((dayLabel, dayOfWeek) => ({
      dayOfWeek,
      dayLabel,
      isOpen: dayOfWeek >= 1 && dayOfWeek <= 5,
      opensAtLocal: dayOfWeek >= 1 && dayOfWeek <= 5 ? '09:00' : null,
      closesAtLocal: dayOfWeek >= 1 && dayOfWeek <= 5 ? '17:00' : null,
    })),
  };
}

function getBrowserTimeZoneId() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
}
