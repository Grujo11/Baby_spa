import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
export const runtime = "nodejs";

export async function GET() {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    return NextResponse.json({
      email: user.email,
      emailVerifiedAt: user.email_verified_at,
      firstName: user.first_name,
      lastName: user.last_name,
      phone: user.phone,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
