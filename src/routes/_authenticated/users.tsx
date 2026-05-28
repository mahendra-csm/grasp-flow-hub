import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/users")({
  component: UsersPage,
});

function UsersPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-2">
      <h1 className="text-2xl font-semibold">Users</h1>
      <p className="text-sm text-muted-foreground">
        User role management is disabled in this version. Use the Leads filters and the rest of the CRM normally.
      </p>
    </div>
  );
}
