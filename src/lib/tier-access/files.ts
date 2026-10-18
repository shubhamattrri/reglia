import { NextResponse } from "next/server";
import { getActiveStaff } from "@/lib/rbac";
import { getMemberId, isAdmin } from "@/lib/session";
import { privateFileResponse } from "@/lib/private-storage";

/** Request files are visible to their owner, the admin desk and any active staff reviewer. */
export async function streamRequestFile(
  ownerId: string,
  file: { path: string | null; name: string | null; mime: string | null },
  download: boolean,
) {
  const allowed = (await isAdmin()) || Boolean(await getActiveStaff()) || (await getMemberId()) === ownerId;
  if (!allowed) return NextResponse.json({ error: "Not found." }, { status: 404 });
  if (!file.path || !file.mime) return NextResponse.json({ error: "File not found." }, { status: 404 });
  return privateFileResponse(file.path, file.mime, file.name || "document", download ? "attachment" : "inline");
}
