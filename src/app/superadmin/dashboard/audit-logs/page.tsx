import AuditLogsViewer from "@/components/admin/AuditLogsViewer";

export const metadata = {
  title: "Audit Logs | Trumate Admin",
};

export default function AuditLogsPage() {
  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
          Audit Logs
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          Immutable trail of authentication, user access, and catalog operations.
        </p>
      </div>

      <AuditLogsViewer />
    </div>
  );
}