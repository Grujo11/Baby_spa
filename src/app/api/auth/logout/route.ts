import { NextResponse } from "next/server";
import { clearSession } from "@/lib/auth";
import { APP_URL } from "@/lib/config";
export const runtime = "nodejs";

export async function POST() {
  await clearSession();
  return NextResponse.redirect(`${APP_URL}?logout=1`);
}
