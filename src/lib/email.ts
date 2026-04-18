/**
 * Email utility using Resend.
 *
 * Set RESEND_API_KEY in your environment variables.
 * Free tier: 100 emails/day, 3000/month.
 *
 * Sign up at https://resend.com and add your domain or use the
 * onboarding@resend.dev sender for testing.
 */

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL =
  process.env.EMAIL_FROM || "Makada Properties <onboarding@resend.dev>";

export type EmailOptions = {
  to: string;
  subject: string;
  html: string;
  replyTo?: string;
};

/**
 * Send an email via Resend. Falls back to console logging
 * if RESEND_API_KEY is not configured.
 */
export async function sendEmail(opts: EmailOptions): Promise<boolean> {
  if (!process.env.RESEND_API_KEY) {
    console.log(`📧 EMAIL (no RESEND_API_KEY — logged only)`);
    console.log(`  To: ${opts.to}`);
    console.log(`  Subject: ${opts.subject}`);
    console.log(`  Reply-To: ${opts.replyTo || "n/a"}`);
    throw new Error("RESEND_API_KEY is not configured — email cannot be sent");
  }

  console.log(`📧 Attempting email via Resend...`);
  console.log(`  From: ${FROM_EMAIL}`);
  console.log(`  To: ${opts.to}`);
  console.log(`  Subject: ${opts.subject}`);

  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      replyTo: opts.replyTo,
    });

    if (error) {
      console.error("[email] Resend error:", JSON.stringify(error));
      throw new Error(`Resend error: ${error.message || JSON.stringify(error)}`);
    }

    console.log(`📧 Email sent successfully to ${opts.to} (id: ${data?.id})`);
    return true;
  } catch (err) {
    console.error("[email] send failed:", err);
    throw err;
  }
}

/**
 * Send a lease signing notification to an existing tenant.
 */
export async function sendLeaseSigningEmail(
  email: string,
  tenantName: string,
  propertyName: string,
  unitLabel: string,
  signingUrl?: string
) {
  const portalUrl =
    signingUrl ||
    `${process.env.TENANT_PORTAL_URL || "https://zmak-zmakada.replit.app"}/tenant/leases`;

  const subject = `Lease Ready for Signing — ${propertyName}, Unit ${unitLabel}`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="color: #1e293b; font-size: 24px; margin: 0;">Makada Properties</h1>
        <p style="color: #64748b; font-size: 13px; margin-top: 4px;">303 Lakeview Way, Emerald Hills, CA 94062</p>
      </div>

      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 32px;">
        <h2 style="color: #1e293b; font-size: 20px; margin: 0 0 16px;">Lease Ready for Your Signature</h2>
        <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 12px;">
          Hi ${tenantName},
        </p>
        <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
          Your lease agreement for <strong>${propertyName}, Unit ${unitLabel}</strong> is ready for your review and signature.
          Please click the button below to review the full lease document and sign electronically.
        </p>

        <div style="text-align: center; margin: 32px 0;">
          <a href="${portalUrl}" style="background-color: #4f46e5; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; display: inline-block;">
            Review &amp; Sign Lease
          </a>
        </div>

        <p style="color: #94a3b8; font-size: 13px; line-height: 1.5; margin: 0;">
          This link will take you to the Makada Properties tenant portal where you can
          view the complete lease document, add your signature and initials, and submit.
        </p>
      </div>

      <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center;">
        <p style="color: #94a3b8; font-size: 12px; margin: 0;">
          If you have questions, reply to this email or contact Makada Properties directly.
        </p>
        <p style="color: #cbd5e1; font-size: 11px; margin-top: 8px;">
          Makada Properties · 303 Lakeview Way, Emerald Hills, CA 94062
        </p>
      </div>
    </div>
  `;

  return sendEmail({
    to: email,
    subject,
    html,
    replyTo: "attysfnm@gmail.com",
  });
}

/**
 * Send a lease signing invitation to a NEW tenant (no portal account yet).
 * Includes a direct signing link with a secure token.
 */
export async function sendLeaseSigningInvite(
  email: string,
  tenantName: string,
  propertyName: string,
  unitLabel: string,
  signingToken: string
) {
  const adminBase =
    process.env.NEXT_PUBLIC_APP_URL || "https://makada-app-5iv3.vercel.app";
  const signingUrl = `${adminBase}/sign/${signingToken}`;

  const subject = `Sign Your Lease — ${propertyName}, Unit ${unitLabel}`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="text-align: center; margin-bottom: 32px;">
        <h1 style="color: #1e293b; font-size: 24px; margin: 0;">Makada Properties</h1>
        <p style="color: #64748b; font-size: 13px; margin-top: 4px;">303 Lakeview Way, Emerald Hills, CA 94062</p>
      </div>

      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 32px;">
        <h2 style="color: #1e293b; font-size: 20px; margin: 0 0 16px;">Welcome to Makada Properties</h2>
        <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 12px;">
          Hi ${tenantName},
        </p>
        <p style="color: #475569; font-size: 15px; line-height: 1.6; margin: 0 0 24px;">
          Your lease agreement for <strong>${propertyName}, Unit ${unitLabel}</strong> is ready.
          Please review the full document and sign electronically using the button below.
        </p>

        <div style="text-align: center; margin: 32px 0;">
          <a href="${signingUrl}" style="background-color: #4f46e5; color: white; padding: 14px 32px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 15px; display: inline-block;">
            Review &amp; Sign Your Lease
          </a>
        </div>

        <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 16px; margin-top: 24px;">
          <p style="color: #92400e; font-size: 13px; line-height: 1.5; margin: 0;">
            <strong>Note:</strong> This link is unique to you and expires in 7 days.
            After signing, you'll receive login credentials for the Makada Properties
            tenant portal where you can view your lease, pay rent, and submit maintenance requests.
          </p>
        </div>
      </div>

      <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid #e2e8f0; text-align: center;">
        <p style="color: #94a3b8; font-size: 12px; margin: 0;">
          If you have questions, reply to this email or contact Makada Properties directly.
        </p>
        <p style="color: #cbd5e1; font-size: 11px; margin-top: 8px;">
          Makada Properties · 303 Lakeview Way, Emerald Hills, CA 94062
        </p>
      </div>
    </div>
  `;

  return sendEmail({
    to: email,
    subject,
    html,
    replyTo: "attysfnm@gmail.com",
  });
}
