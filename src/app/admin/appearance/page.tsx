import { redirect } from "next/navigation";

export default function AdminAppearanceRedirect() {
  redirect("/admin/settings/appearance");
}
