import { NextResponse } from "next/server";
import { isDateWithinWindow, parseDateOnly } from "@/lib/booking";
import { query } from "@/lib/db";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const dateParam = searchParams.get("date");

  if (!dateParam) {
    return NextResponse.json({ slots: [] });
  }

  const date = parseDateOnly(dateParam);
  if (!isDateWithinWindow(date)) {
    return NextResponse.json({ slots: [] });
  }

  const slotsResult = await query(
    `SELECT id, start_time, end_time
     FROM time_slots
     WHERE work_date = $1 AND status = 'AVAILABLE'
     ORDER BY start_time ASC`,
    [date]
  );

  return NextResponse.json({
    slots: slotsResult.rows.map((slot) => ({
      id: slot.id,
      startTime: slot.start_time.toISOString().slice(11, 16),
      endTime: slot.end_time.toISOString().slice(11, 16),
    })),
  });
}
