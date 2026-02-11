import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { buildHourlySlots } from "@/lib/booking";
import { query } from "@/lib/db";

export const runtime = "nodejs";

function toTimeString(date: Date) {
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${hour}:${minute}`;
}

export async function POST(
  _request: Request,
  context: { params: { id: string } }
) {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Niste admin." }, { status: 403 });
  }

  const { id } = context.params;
  const workDayResult = await query("SELECT * FROM work_days WHERE id = $1", [id]);
  const workDay = workDayResult.rows[0];

  if (!workDay) {
    return NextResponse.json({ error: "Datum ne postoji." }, { status: 404 });
  }

  if (workDay.is_closed || !workDay.start_time || !workDay.end_time) {
    return NextResponse.json({ createdCount: 0 });
  }

  const slots = buildHourlySlots(
    new Date(workDay.work_date),
    workDay.start_time.slice(0, 5),
    workDay.end_time.slice(0, 5)
  );

  let created = 0;
  for (const slot of slots) {
    const result = await query(
      `INSERT INTO time_slots (work_date, start_time, end_time, status, work_day_id)
       VALUES ($1, $2, $3, 'AVAILABLE', $4)
       ON CONFLICT DO NOTHING`,
      [workDay.work_date, slot.start, slot.end, workDay.id]
    );
    created += result.rowCount ?? 0;
  }

  return NextResponse.json({ createdCount: created });
}
