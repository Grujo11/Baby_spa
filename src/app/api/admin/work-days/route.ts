import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { addDays, isDateWithinWindow, parseDateOnly, startOfDay } from "@/lib/booking";
import { query } from "@/lib/db";
export const runtime = "nodejs";

const schema = z.object({
  date: z.string(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  isClosed: z.boolean().optional(),
});

function parseTime(value: string) {
  const [hour, minute] = value.split(":").map(Number);
  const date = new Date(1970, 0, 1, hour, minute, 0, 0);
  return date;
}

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Niste admin." }, { status: 403 });
  }

  const body = await request.json();
  const result = schema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: "Neispravni podaci." }, { status: 400 });
  }

  const workDate = parseDateOnly(result.data.date);
  if (!isDateWithinWindow(workDate)) {
    return NextResponse.json({ error: "Datum nije u dozvoljenom opsegu." }, { status: 400 });
  }

  const isClosed = result.data.isClosed ?? false;
  const startTime = result.data.startTime ? parseTime(result.data.startTime) : null;
  const endTime = result.data.endTime ? parseTime(result.data.endTime) : null;

  const workDay = await query(
    `INSERT INTO work_days (work_date, start_time, end_time, is_closed, created_by_admin_id)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (work_date) DO UPDATE SET
       start_time = EXCLUDED.start_time,
       end_time = EXCLUDED.end_time,
       is_closed = EXCLUDED.is_closed,
       created_by_admin_id = EXCLUDED.created_by_admin_id
     RETURNING id`,
    [workDate, startTime, endTime, isClosed, user.id]
  );

  return NextResponse.json({ id: workDay.rows[0].id });
}

function toTimeString(value: Date | null) {
  if (!value) return null;
  const hour = String(value.getHours()).padStart(2, "0");
  const minute = String(value.getMinutes()).padStart(2, "0");
  return `${hour}:${minute}`;
}

export async function GET() {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Niste admin." }, { status: 403 });
  }

  const start = startOfDay(new Date());
  const end = addDays(start, 7);

  const workDays = await query(
    `SELECT * FROM work_days
     WHERE work_date >= $1 AND work_date < $2
     ORDER BY work_date ASC`,
    [start, end]
  );
  const slotGroups = await query(
    `SELECT work_date, status, COUNT(*) as count
     FROM time_slots
     WHERE work_date >= $1 AND work_date < $2
     GROUP BY work_date, status`,
    [start, end]
  );
  const countMap = new Map<string, Record<string, number>>();
  for (const group of slotGroups.rows) {
    const key = group.work_date.toISOString().slice(0, 10);
    if (!countMap.has(key)) {
      countMap.set(key, {});
    }
    countMap.get(key)![group.status] = Number(group.count);
  }

  return NextResponse.json({
    workDays: workDays.rows.map((day) => {
      const key = day.work_date.toISOString().slice(0, 10);
      const counts = countMap.get(key) ?? {};
      return {
        id: day.id,
        date: key,
        startTime: day.start_time ? day.start_time.slice(0, 5) : null,
        endTime: day.end_time ? day.end_time.slice(0, 5) : null,
        isClosed: day.is_closed,
        counts: {
          available: counts.AVAILABLE ?? 0,
          booked: counts.BOOKED ?? 0,
          blocked: counts.BLOCKED ?? 0,
        },
      };
    }),
  });
}
