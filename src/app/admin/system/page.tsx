import { redirect } from "next/navigation";

export default function AdminSystemRedirect() {
  redirect("/admin/settings");
}
