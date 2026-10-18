import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashPassword, verifyPassword } from "@/lib/password";
import { MEMBER_DEACTIVATED_MESSAGE, setMemberSession } from "@/lib/session";
import { clearRateLimit, clientIp, rateLimit } from "@/lib/rate-limit";
import { canonicalIdentifier, looksLikeEmail } from "@/lib/registry/format";
import { findMemberByIdentifier } from "@/lib/registry/service";

const GENERIC = "The identifier or password is incorrect.";
/** Hash compared against when no account matches, so unknown identifiers take as long as wrong passwords. */
const TIMING_DECOY = hashPassword("regalia-timing-decoy");

/**
 * Member sign-in with one identifier field: email, REGALIA ID or Membership Code, plus password.
 * Responses never reveal whether an identifier exists, nor any tier/word/profile detail.
 */
export async function memberLogin(req: Request) {
  const body = (await req.json().catch(() => null)) as {
    identifier?: string;
    email?: string;
    password?: string;
  } | null;
  const identifier = String(body?.identifier ?? body?.email ?? "").trim().slice(0, 200);
  const password = String(body?.password ?? "");
  if (!identifier || !password) {
    return NextResponse.json({ error: "Enter your identifier and password." }, { status: 400 });
  }

  const ip = clientIp(req);
  const ipGate = rateLimit(`member-login:ip:${ip}`, 20, 15 * 60_000);
  const idKey = `member-login:id:${canonicalIdentifier(identifier).toLowerCase()}`;
  const idGate = rateLimit(idKey, 8, 15 * 60_000);
  if (!ipGate.ok || !idGate.ok) {
    const retryAfter = Math.max(ipGate.ok ? 0 : ipGate.retryAfter, idGate.ok ? 0 : idGate.retryAfter);
    return NextResponse.json(
      { error: "Too many attempts. Please wait a few minutes and try again." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  const member = looksLikeEmail(identifier)
    ? await prisma.member.findUnique({ where: { email: identifier.toLowerCase() } })
    : await findMemberByIdentifier(prisma, identifier);

  const ok = verifyPassword(password, member?.passwordHash || TIMING_DECOY);
  if (!member?.passwordHash || !ok) {
    return NextResponse.json({ error: GENERIC }, { status: 401 });
  }

  clearRateLimit(idKey);
  if (member.accountStatus === "DEACTIVATED") {
    return NextResponse.json({ error: MEMBER_DEACTIVATED_MESSAGE }, { status: 403 });
  }
  await setMemberSession(member.id);
  return NextResponse.json({ ok: true });
}
