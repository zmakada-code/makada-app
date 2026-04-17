import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export type SearchHit = {
  kind: "tenant" | "property" | "unit" | "inquiry";
  id: string;
  title: string;
  subtitle?: string;
  href: string;
};

/**
 * Global search across tenants, properties, units, and inquiries.
 * Auth is handled by the middleware — no need to re-check here.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json({ hits: [] as SearchHit[] });
  }

  const contains = { contains: q, mode: "insensitive" as const };

  const [tenants, properties, units, inquiries] = await Promise.all([
    prisma.tenant.findMany({
      where: {
        OR: [
          { fullName: contains },
          { email: contains },
          { phone: contains },
        ],
      },
      take: 5,
      orderBy: { fullName: "asc" },
      select: { id: true, fullName: true, email: true, phone: true },
    }),
    prisma.property.findMany({
      where: {
        OR: [{ name: contains }, { address: contains }],
      },
      take: 5,
      orderBy: { name: "asc" },
      select: { id: true, name: true, address: true },
    }),
    prisma.unit.findMany({
      where: {
        OR: [
          { label: contains },
          { property: { name: contains } },
        ],
      },
      take: 5,
      orderBy: [{ property: { name: "asc" } }, { label: "asc" }],
      select: {
        id: true,
        label: true,
        propertyId: true,
        property: { select: { name: true } },
      },
    }),
    prisma.inquiry.findMany({
      where: {
        OR: [
          { prospectName: contains },
          { email: contains },
          { phone: contains },
        ],
      },
      take: 5,
      orderBy: { createdAt: "desc" },
      select: { id: true, prospectName: true, status: true, email: true, phone: true },
    }),
  ]);

  const hits: SearchHit[] = [
    ...tenants.map<SearchHit>((t) => ({
      kind: "tenant",
      id: t.id,
      title: t.fullName,
      subtitle: t.email ?? t.phone ?? undefined,
      href: `/tenants/${t.id}`,
    })),
    ...properties.map<SearchHit>((p) => ({
      kind: "property",
      id: p.id,
      title: p.name,
      subtitle: p.address,
      href: `/properties/${p.id}`,
    })),
    ...units.map<SearchHit>((u) => ({
      kind: "unit",
      id: u.id,
      title: `${u.property.name} · ${u.label}`,
      subtitle: "Unit",
      href: `/properties/${u.propertyId}`,
    })),
    ...inquiries.map<SearchHit>((i) => ({
      kind: "inquiry",
      id: i.id,
      title: i.prospectName,
      subtitle: `Inquiry · ${i.status.toLowerCase()}`,
      href: `/inquiries/${i.id}`,
    })),
  ];

  return NextResponse.json({ hits });
}
