import { NextResponse } from "next/server";
import { createInquiryFromPayload } from "@/lib/actions/inquiries";
import type { InquirySource } from "@prisma/client";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ALLOWED_SOURCES: InquirySource[] = ["WEBSITE", "WALK_IN", "REFERRAL", "OTHER"];

/**
 * Internal intake endpoint for inquiries.
 *
 * The public Replit marketing site is expected to POST here with a shared
 * secret in the `x-intake-secret` header. No cookies / no CORS — this is
 * strictly a server-to-server handoff.
 *
 * Expected JSON body:
 *   {
 *     "prospectName": "Jane Doe",
 *     "phone": "(555) 123-4567",        // phone OR email required
 *     "email": "jane@example.com",
 *     "message": "Interested in the 2BR",
 *     "unitId": "optional-internal-unit-id",
 *     "source": "WEBSITE"               // defaults to WEBSITE
 *   }
 */
export async function POST(req: Request) {
  const expected = process.env.INQUIRY_INTAKE_SECRET;
  if (!expected) {
    return NextResponse.json(
      { error: "Intake endpoint is not configured." },
      { status: 503 }
    );
  }
  const provided = req.headers.get("x-intake-secret");
  if (provided !== expected) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const source =
    typeof body.source === "string" &&
    ALLOWED_SOURCES.includes(body.source as InquirySource)
      ? (body.source as InquirySource)
      : "WEBSITE";

  try {
    const created = await createInquiryFromPayload({
      prospectName: String(body.prospectName ?? ""),
      phone: body.phone ? String(body.phone) : null,
      email: body.email ? String(body.email) : null,
      message: body.message ? String(body.message) : null,
      unitId: body.unitId ? String(body.unitId) : null,
      source,
    });
    return NextResponse.json(
      { id: created.id, status: created.status },
      { status: 201 }
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : "Bad request.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
