import { redirect } from "next/navigation";

import { getAuthSession } from "@/lib/auth-helpers";
import { AdminKenyaPanel } from "@/components/admin/adminkenya-panel";

/**
 * Hidden super-admin control room.
 *
 * Not linked anywhere in the user panel. Access is enforced server-side:
 * only super_admin sessions render the panel; everyone else is redirected.
 * Every data mutation is independently re-checked by requireRole(SUPER_ADMIN)
 * in the API layer, so this page being public would not grant access.
 */
export const dynamic = "force-dynamic";

export default async function AdminKenyaPage() {
  const session = await getAuthSession();
  const user = session?.user;

  if (!user?.id) redirect("/");
  if (user.role !== "super_admin") redirect("/");

  return <AdminKenyaPanel user={{
    name: user.name ?? user.email ?? "Admin",
    email: user.email ?? "",
  }} />;
}
