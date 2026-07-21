import { getPasswordResetPreview } from "@/lib/actions";
import { ResetPasswordClient } from "@/components/reset-password-client";

export default async function ResetPasswordPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const preview = await getPasswordResetPreview(token);

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--surface)] px-4 py-10">
      <ResetPasswordClient
        token={token}
        preview={
          preview.ok
            ? {
                name: preview.name,
                email: preview.email,
                businessName: preview.businessName,
                expiresAt: preview.expiresAt,
              }
            : { error: preview.error }
        }
      />
    </div>
  );
}
