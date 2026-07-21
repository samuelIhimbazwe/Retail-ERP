import { getInvitePreview } from "@/lib/actions";
import { InviteAcceptClient } from "@/components/invite-accept-client";

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const preview = await getInvitePreview(token);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--surface)] px-4 py-10">
      <InviteAcceptClient
        token={token}
        preview={
          preview.ok
            ? {
                name: preview.name,
                email: preview.email,
                role: preview.role,
                businessName: preview.businessName,
                branchName: preview.branchName,
                expiresAt: preview.expiresAt,
                terms: preview.terms,
                termsVersion: preview.termsVersion,
              }
            : { error: preview.error }
        }
      />
    </div>
  );
}
