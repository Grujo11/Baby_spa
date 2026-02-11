import { NextResponse } from "next/server";
import { z } from "zod";
import { createEmailVerificationToken, createLoginToken } from "@/lib/auth";
import { query } from "@/lib/db";
import { sendLoginEmail, sendVerificationEmail } from "@/lib/email";
import { APP_URL } from "@/lib/config";
export const runtime = "nodejs";

const schema = z.object({
  email: z.string().email(),
});

export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  const body =
    contentType.includes("application/json")
      ? await request.json()
      : Object.fromEntries(await request.formData());
  const result = schema.safeParse(body);

  if (!result.success) {
    if (contentType.includes("application/json")) {
      return NextResponse.json({ error: "Neispravan email." }, { status: 400 });
    }
    return NextResponse.redirect(`${APP_URL}/login?error=1`);
  }

  const email = result.data.email.toLowerCase();
  const result = await query(
    `INSERT INTO users (email)
     VALUES ($1)
     ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
     RETURNING *`,
    [email]
  );
  const user = result.rows[0];

  if (!user.email_verified_at) {
    const token = await createEmailVerificationToken(user.id);
    await sendVerificationEmail(user.email, token);
    if (contentType.includes("application/json")) {
      return NextResponse.json({ ok: true });
    }
    return NextResponse.redirect(`${APP_URL}/login?sent=1`);
  }

  const token = await createLoginToken(user.id);
  await sendLoginEmail(user.email, token);
  if (contentType.includes("application/json")) {
    return NextResponse.json({ ok: true });
  }
  return NextResponse.redirect(`${APP_URL}/login?sent=1`);
}
