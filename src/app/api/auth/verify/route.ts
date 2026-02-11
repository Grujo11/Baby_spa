import { NextResponse } from "next/server";
import { hashToken } from "@/lib/crypto";
import { createSession } from "@/lib/auth";
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
  const recordResult = await query(
    `SELECT t.*, u.email_verified_at
     FROM email_verification_tokens t
     JOIN users u ON u.id = t.user_id
     WHERE t.token_hash = $1 AND t.used_at IS NULL AND t.expires_at > now()
     LIMIT 1`,
    [tokenHash]
  );
  const record = recordResult.rows[0];

  if (!record) {
    return NextResponse.redirect(`${APP_URL}?error=invalid-token`);
  }

  await query("UPDATE email_verification_tokens SET used_at = now() WHERE id = $1", [
    record.id,
  ]);
  await query(
    "UPDATE users SET email_verified_at = COALESCE(email_verified_at, now()) WHERE id = $1",
    [record.user_id]
  );

  await createSession(record.user_id);
  return NextResponse.redirect(`${APP_URL}?verified=1`);
}
