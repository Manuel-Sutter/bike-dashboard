import { NextRequest, NextResponse } from "next/server";
import { upsertTodayCheckin } from "@/lib/checkins";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const kneeStatus = Number(body?.kneeStatus);

  if (!Number.isInteger(kneeStatus) || kneeStatus < 1 || kneeStatus > 5) {
    return NextResponse.json({ error: "kneeStatus must be an integer 1-5" }, { status: 400 });
  }

  await upsertTodayCheckin(kneeStatus);
  return NextResponse.json({ ok: true });
}
