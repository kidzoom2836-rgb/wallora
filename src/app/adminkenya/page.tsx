import { getAuthSession } from "@/lib/auth-helpers";
import { AdminKenyaPanel } from "@/components/admin/adminkenya-panel";
import { AdminAccessDenied } from "@/components/admin/admin-access-denied";

/**
 * Hidden super-admin control room.
 *
 * Not linked anywhere in the user panel. Access is enforced server-side:
 * only super_admin sessions render the panel. Every data mutation is
 * independently re-checked by requireRole(SUPER_ADMIN) in the API layer.
 */
export const dynamic = "force-dynamic";

export default async function AdminKenyaPage() {
  const session = await getAuthSession();
  const user = session?.user;

  if (!user?.id || user.role !== "super_admin") {
    return <AdminAccessDenied signedIn={!!user?.id} email={user?.email ?? null} />;
  }

  return <AdminKenyaPanel user={{
    name: user.name ?? user.email ?? "Admin",
    email: user.email ?? "",
  }} />;
}
