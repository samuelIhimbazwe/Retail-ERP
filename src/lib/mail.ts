import nodemailer from "nodemailer";

export type MailDelivery = {
  emailed: boolean;
  mailError?: string;
};

export function isSmtpConfigured() {
  return Boolean(process.env.SMTP_HOST?.trim() && process.env.SMTP_FROM?.trim());
}

function smtpPort() {
  const n = Number(process.env.SMTP_PORT || 587);
  return Number.isFinite(n) ? n : 587;
}

async function getTransport() {
  const host = process.env.SMTP_HOST?.trim();
  if (!host) return null;

  const port = smtpPort();
  const user = process.env.SMTP_USER?.trim();
  const pass = process.env.SMTP_PASS?.trim();

  return nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: user && pass ? { user, pass } : undefined,
  });
}

export async function sendAppEmail(input: {
  to: string;
  subject: string;
  text: string;
  html?: string;
}): Promise<MailDelivery> {
  if (!isSmtpConfigured()) {
    return { emailed: false };
  }

  const from = process.env.SMTP_FROM!.trim();
  const transport = await getTransport();
  if (!transport) return { emailed: false };

  try {
    await transport.sendMail({
      from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html ?? `<pre style="font-family:system-ui,sans-serif;white-space:pre-wrap">${input.text.replace(/</g, "&lt;")}</pre>`,
    });
    return { emailed: true };
  } catch (err) {
    const mailError = err instanceof Error ? err.message : "Email send failed";
    console.error(`[RBIAP mail] failed to ${input.to}:`, mailError);
    return { emailed: false, mailError };
  }
}

export function inviteEmailBody(input: { name: string; inviteUrl: string; businessHint?: string }) {
  const biz = input.businessHint ? ` ${input.businessHint}` : "";
  return {
    subject: `You're invited to RBIAP${biz}`,
    text: `Hi ${input.name},\n\nYou've been invited to join RBIAP${biz}.\n\nOpen this link to review the terms and set your password (expires in 7 days):\n${input.inviteUrl}\n\nIf you did not expect this, ignore this message.`,
  };
}

export function resetEmailBody(input: { name: string; resetUrl: string }) {
  return {
    subject: "Reset your RBIAP password",
    text: `Hi ${input.name},\n\nUse this link to set a new password (expires in 24 hours):\n${input.resetUrl}\n\nIf you did not request this, tell your administrator.`,
  };
}
