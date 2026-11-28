import AdminProfileView from "@/components/admin/AdminProfileView";

export const metadata = {
  title: "My Profile | Trumate Admin",
};

export default function AdminProfilePage() {
  return (
    <div className="min-h-screen space-y-6 bg-zinc-50/70 p-6">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-zinc-900">
          My Profile
        </h1>
        <p className="mt-0.5 text-xs text-zinc-500">
          View your account identity, assigned role, and active RBAC permissions.
        </p>
      </div>

      <AdminProfileView />
    </div>
  );
}