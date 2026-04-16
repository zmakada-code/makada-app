import { NextResponse } from "next/server";

// Auth is no longer required — redirect any stale callbacks to the dashboard.
export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  return NextResponse.redirect(`${origin}/dashboard`);
}
