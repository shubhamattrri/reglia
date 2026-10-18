import { AdminLayout } from "@/components/admin/admin-layout";
import { getAdminActor } from "@/lib/session";

export default async function AdminRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const actor = await getAdminActor();
  return <AdminLayout actorName={actor?.id ? actor.name : null}>{children}</AdminLayout>;
}
