import { NextResponse } from "next/server";
import { hashToken } from "@/lib/crypto";
import { formatDateLabel, formatTimeLabel } from "@/lib/booking";
import { sendReservationCanceledEmail } from "@/lib/email";
import { APP_URL } from "@/lib/config";
import { query } from "@/lib/db";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(`${APP_URL}?error=missing-token`);
  }

  const tokenHash = hashToken(token);
  const cancelResult = await query(
    `SELECT r.*, s.start_time, s.work_date, u.email
     FROM reservation_cancel_tokens t
     JOIN reservations r ON r.id = t.reservation_id
     JOIN time_slots s ON s.id = r.slot_id
     JOIN users u ON u.id = r.user_id
     WHERE t.token_hash = $1 AND t.used_at IS NULL AND t.expires_at > now()
     LIMIT 1`,
    [tokenHash]
  );
  const cancelToken = cancelResult.rows[0];

  if (!cancelToken || cancelToken.status !== "ACTIVE") {
    return NextResponse.redirect(`${APP_URL}?error=invalid-token`);
  }

  await query("UPDATE reservation_cancel_tokens SET used_at = now() WHERE token_hash = $1", [
    tokenHash,
  ]);
  await query("UPDATE reservations SET status = 'CANCELED', canceled_at = now() WHERE id = $1", [
    cancelToken.id,
  ]);
  await query("UPDATE time_slots SET status = 'AVAILABLE' WHERE id = $1", [
    cancelToken.slot_id,
  ]);

  await sendReservationCanceledEmail(
    cancelToken.email,
    formatDateLabel(new Date(cancelToken.work_date)),
    formatTimeLabel(new Date(cancelToken.start_time))
  );

  return NextResponse.redirect(`${APP_URL}?canceled=1`);
}
