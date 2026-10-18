import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isAdmin } from "@/lib/session";
import { logActivity } from "@/lib/activity";
import { parseAddress, parseDateOfBirth, parseFullName, parsePhone } from "@/lib/member-profile";

/** Each key is optional; an empty phone, date of birth or address clears it. */
function parseMemberEdit(body: Record<string, unknown>): { ok: true; data: Prisma.MemberUpdateInput } | { ok: false; error: string } {
  const data: Prisma.MemberUpdateInput = {};
  if (body.fullName !== undefined) {
    const name = parseFullName(body.fullName);
    if (!name.ok) return name;
    data.fullName = name.value;
  }
  if (body.email !== undefined) {
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    if (!/^\S+@\S+\.\S+$/.test(email)) return { ok: false, error: "Enter a valid email." };
    data.email = email;
  }
  if (body.phone !== undefined) {
    if (body.phone === null || body.phone === "") data.phone = null;
    else {
      const phone = parsePhone(body.phone);
      if (!phone.ok) return phone;
      data.phone = phone.value;
    }
  }
  if (body.dateOfBirth !== undefined) {
    if (body.dateOfBirth === null || body.dateOfBirth === "") data.dateOfBirth = null;
    else {
      const dob = parseDateOfBirth(body.dateOfBirth);
      if (!dob.ok) return dob;
      data.dateOfBirth = dob.value;
    }
  }
  if (body.address !== undefined) {
    if (body.address === null || body.address === "") data.address = null;
    else {
      const address = parseAddress(body.address);
      if (!address.ok) return address;
      data.address = address.value;
    }
  }
  if (body.accountStatus !== undefined) {
    if (body.accountStatus !== "ACTIVE" && body.accountStatus !== "DEACTIVATED") {
      return { ok: false, error: "Account status must be ACTIVE or DEACTIVATED." };
    }
    const note = typeof body.deactivationNote === "string" ? body.deactivationNote.trim().slice(0, 300) : "";
    data.accountStatus = body.accountStatus;
    data.deactivatedAt = body.accountStatus === "DEACTIVATED" ? new Date() : null;
    data.deactivationNote = body.accountStatus === "DEACTIVATED" ? note || null : null;
  }
  return { ok: true, data };
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Send a JSON object." }, { status: 400 });
  }
  const edit = parseMemberEdit(body);
  if (!edit.ok) return NextResponse.json({ error: edit.error }, { status: 400 });

  if (typeof edit.data.email === "string") {
    const taken = await prisma.member.findFirst({ where: { email: edit.data.email, NOT: { id } }, select: { id: true } });
    if (taken) return NextResponse.json({ error: "Another member already uses this email." }, { status: 409 });
  }

  const member = await prisma.member.update({
    where: { id },
    data: edit.data,
    omit: { passwordHash: true },
  });
  if (edit.data.accountStatus) {
    await logActivity(
      edit.data.accountStatus === "DEACTIVATED" ? "MEMBER_DEACTIVATED" : "MEMBER_REACTIVATED",
      `${member.regaliaId ?? member.email}${member.deactivationNote ? ` · ${member.deactivationNote}` : ""}`,
    );
  }
  return NextResponse.json(member);
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  if (!(await isAdmin())) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const member = await prisma.member.findUnique({ where: { id }, select: { memberUuid: true } });
  if (!member) return NextResponse.json({ ok: true });
  await prisma.$transaction([
    prisma.registryWord.updateMany({
      where: { memberUuid: member.memberUuid, status: { in: ["RESERVED", "ISSUED"] } },
      data: { status: "RETIRED", retiredAt: new Date() },
    }),
    prisma.member.delete({ where: { id } }),
  ]);
  return NextResponse.json({ ok: true });
}
