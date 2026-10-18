import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword } from "@/lib/password";
import { MEMBER_DEACTIVATED_MESSAGE, setMemberSession } from "@/lib/session";
import { logActivity } from "@/lib/activity";
import { parseMemberProfile } from "@/lib/member-profile";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || typeof body !== "object") {
      return NextResponse.json({ error: "Send your details as JSON." }, { status: 400 });
    }

    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const password = typeof body.password === "string" ? body.password : "";

    const profile = parseMemberProfile(body);
    if (!profile.ok) return NextResponse.json({ error: profile.error }, { status: 400 });
    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json(
        { error: "Password must be at least 6 characters." },
        { status: 400 }
      );
    }

    const existing = await prisma.member.findUnique({ where: { email } });
    if (existing) {
      if (existing.accountStatus === "DEACTIVATED") {
        return NextResponse.json({ error: MEMBER_DEACTIVATED_MESSAGE }, { status: 403 });
      }
      if (existing.passwordHash) {
        return NextResponse.json(
          { error: "An account with this email already exists. Sign in instead." },
          { status: 409 }
        );
      }
      // Accounts created by the admin desk keep the name on record; only missing details are filled in.
      await prisma.member.update({
        where: { id: existing.id },
        data: {
          passwordHash: hashPassword(password),
          phone: existing.phone || profile.value.phone,
          dateOfBirth: existing.dateOfBirth ?? profile.value.dateOfBirth,
          address: existing.address || profile.value.address,
        },
      });
      await setMemberSession(existing.id);
      return NextResponse.json({ ok: true, regaliaId: existing.regaliaId });
    }

    const member = await prisma.member.create({
      data: { ...profile.value, email, passwordHash: hashPassword(password) },
    });

    await setMemberSession(member.id);
    try {
      await logActivity("MEMBER_SIGNUP", `Registered ${member.fullName} · ${member.email}`);
    } catch {
      /* session already set */
    }

    return NextResponse.json({ ok: true, regaliaId: member.regaliaId });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create your account.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
