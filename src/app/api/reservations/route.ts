import { NextResponse } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/auth";
import { generateToken, hashToken } from "@/lib/crypto";
import { formatDateLabel, formatTimeLabel, isDateWithinWindow } from "@/lib/booking";
import { sendReservationConfirmationEmail } from "@/lib/email";
import { APP_URL } from "@/lib/config";
import { pool, query } from "@/lib/db";
export const runtime = "nodejs";

const schema = z.object({
  slotId: z.string().uuid(),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  phone: z.string().min(5),
  notes: z.string().optional(),
});

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Niste ulogovani." }, { status: 401 });
  }
  if (!user.email_verified_at) {
    return NextResponse.json({ error: "Email nije potvrdjen." }, { status: 403 });
  }

  const body = await request.json();
  const result = schema.safeParse(body);
  if (!result.success) {
    return NextResponse.json({ error: "Neispravni podaci." }, { status: 400 });
  }

  const { slotId, firstName, lastName, phone, notes } = result.data;
  const cancelToken = generateToken();
  const cancelTokenHash = hashToken(cancelToken);
  const cancelExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const slotResult = await client.query(
      "SELECT * FROM time_slots WHERE id = $1 AND status = 'AVAILABLE' FOR UPDATE",
      [slotId]
    );
    const slot = slotResult.rows[0];
    if (!slot) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Termin nije dostupan." }, { status: 409 });
    }
    if (!isDateWithinWindow(slot.work_date)) {
      await client.query("ROLLBACK");
      return NextResponse.json({ error: "Termin nije u dozvoljenom opsegu." }, { status: 400 });
    }

    await client.query("UPDATE time_slots SET status = 'BOOKED' WHERE id = $1", [slotId]);
    const reservationResult = await client.query(
      `INSERT INTO reservations (user_id, slot_id, first_name, last_name, phone, notes)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [user.id, slotId, firstName, lastName, phone, notes ?? null]
    );
    await client.query(
      `INSERT INTO reservation_cancel_tokens (reservation_id, token_hash, expires_at)
       VALUES ($1, $2, $3)`,
      [reservationResult.rows[0].id, cancelTokenHash, cancelExpiresAt]
    );
    await client.query(
      `UPDATE users SET first_name = $1, last_name = $2, phone = $3 WHERE id = $4`,
      [firstName, lastName, phone, user.id]
    );
    await client.query("COMMIT");

    const cancelUrl = `${APP_URL}/api/reservations/cancel?token=${cancelToken}`;
    await sendReservationConfirmationEmail(
      user.email,
      formatDateLabel(new Date(slot.work_date)),
      formatTimeLabel(new Date(slot.start_time)),
      cancelUrl
    );

    return NextResponse.json({ id: reservationResult.rows[0].id });
  } catch (error) {
    await client.query("ROLLBACK");
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  } finally {
    client.release();
  }
}
