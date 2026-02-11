import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { formatDateLabel, formatTimeLabel } from "@/lib/booking";
import { sendReminderEmail } from "@/lib/email";
import { query } from "@/lib/db";
export const runtime = "nodejs";

export async function POST() {
  const cronSecret = process.env.CRON_SECRET;
  const incomingSecret = headers().get("x-cron-secret");
  if (cronSecret && cronSecret !== incomingSecret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const windowStart = new Date(now.getTime() + 2 * 60 * 60 * 1000);
  const windowEnd = new Date(windowStart.getTime() + 15 * 60 * 1000);

  const result = await query(
    `SELECT r.id, s.start_time, s.work_date, u.email
     FROM reservations r
     JOIN time_slots s ON s.id = r.slot_id
     JOIN users u ON u.id = r.user_id
     WHERE r.status = 'ACTIVE' AND r.reminder_sent_at IS NULL
       AND s.start_time >= $1 AND s.start_time < $2`,
    [windowStart, windowEnd]
  );

  for (const row of result.rows) {
    await sendReminderEmail(
      row.email,
      formatDateLabel(new Date(row.work_date)),
      formatTimeLabel(new Date(row.start_time))
    );

    await query("UPDATE reservations SET reminder_sent_at = now() WHERE id = $1", [
      row.id,
    ]);
  }

  return NextResponse.json({ sent: result.rows.length });
}
