import { BOOKING_WINDOW_DAYS } from "@/lib/config";

export function isDateWithinWindow(date: Date) {
  const today = startOfDay(new Date());
  const last = addDays(today, BOOKING_WINDOW_DAYS - 1);
  return date >= today && date <= last;
}

export function startOfDay(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

export function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function parseDateOnly(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

export function formatDateLabel(date: Date) {
  return new Intl.DateTimeFormat("sr-RS", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(date);
}

export function formatTimeLabel(date: Date) {
  return new Intl.DateTimeFormat("sr-RS", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function buildHourlySlots(workDate: Date, startTime: string, endTime: string) {
  const [startHour, startMinute] = startTime.split(":").map(Number);
  const [endHour, endMinute] = endTime.split(":").map(Number);
  const start = new Date(workDate);
  start.setHours(startHour, startMinute, 0, 0);
  const end = new Date(workDate);
  end.setHours(endHour, endMinute, 0, 0);

  if (start >= end) {
    return [];
  }

  const slots: { start: Date; end: Date }[] = [];
  let cursor = new Date(start);
  while (cursor.getTime() + 60 * 60 * 1000 <= end.getTime()) {
    const next = new Date(cursor.getTime() + 60 * 60 * 1000);
    slots.push({ start: new Date(cursor), end: next });
    cursor = next;
  }

  return slots;
}
