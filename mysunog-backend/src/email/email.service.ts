import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Resend } from 'resend';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService implements OnModuleInit {
  private resend: Resend;
  private from: string;
  private readonly logger = new Logger(EmailService.name);

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const apiKey = this.configService.get<string>('RESEND_API_KEY');
    this.resend = new Resend(apiKey);
    this.from = this.configService.get<string>('MAIL_FROM') || 'onboarding@resend.dev';
  }

  async sendAccountApproved(user: {
    email: string;
    firstName?: string;
    lastName?: string;
  }): Promise<void> {
    const name =
      [user.firstName, user.lastName].filter(Boolean).join(' ') || 'Valued Citizen';

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Account Approved — MySunog</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#dc2626,#ea580c);padding:36px 40px;text-align:center;">
              <p style="margin:0;font-size:28px;">&#128293;</p>
              <h1 style="margin:8px 0 0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.5px;">
                MySunog Fire Safety System
              </h1>
              <p style="margin:4px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">
                Bureau of Fire Protection
              </p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <p style="margin:0 0 8px;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;font-weight:600;">
                Account Status Update
              </p>
              <h2 style="margin:0 0 20px;font-size:24px;color:#111827;font-weight:700;">
                Your Account Has Been Approved &#10003;
              </h2>
              <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.7;">
                Dear <strong>${name}</strong>,
              </p>
              <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.7;">
                We are pleased to inform you that your registration for the
                <strong>MySunog Fire Safety Management System</strong> has been reviewed
                and officially <strong>approved</strong> by our administrator.
              </p>
              <p style="margin:0 0 28px;font-size:15px;color:#374151;line-height:1.7;">
                You may now log in to access all available services, including fire permit
                applications, incident reporting, and community fire safety resources.
              </p>

              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center">
                    <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/login"
                       style="display:inline-block;background:linear-gradient(135deg,#dc2626,#ea580c);color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 36px;border-radius:8px;letter-spacing:0.3px;">
                      Log In to MySunog
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 40px;"><hr style="border:none;border-top:1px solid #e5e7eb;margin:0;" /></td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px 36px;text-align:center;">
              <p style="margin:0 0 4px;font-size:13px;color:#6b7280;line-height:1.6;">
                If you did not register for this account, please ignore this email.
              </p>
              <p style="margin:0;font-size:13px;color:#9ca3af;">
                &copy; ${new Date().getFullYear()} MySunog &mdash; Bureau of Fire Protection &nbsp;|&nbsp; Fire Safety Management System
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();

    try {
      const { error } = await this.resend.emails.send({
        from: this.from,
        to: user.email,
        subject: 'Your MySunog Account Has Been Approved',
        html,
      });

      if (error) {
        this.logger.error(`Resend error for ${user.email}: ${JSON.stringify(error)}`);
      } else {
        this.logger.log(`Approval email sent to ${user.email}`);
      }
    } catch (err) {
      // Non-fatal — never block the approval if email fails
      this.logger.error(`Failed to send approval email to ${user.email}`, err);
    }
  }

  async sendTempPassword(
    user: { email: string; firstName?: string; lastName?: string },
    tempPassword: string,
  ): Promise<void> {
    const name =
      [user.firstName, user.lastName].filter(Boolean).join(' ') || 'User';

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Password Reset — MySunog</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#dc2626,#ea580c);padding:36px 40px;text-align:center;">
              <p style="margin:0;font-size:28px;">&#128293;</p>
              <h1 style="margin:8px 0 0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.5px;">
                MySunog Fire Safety System
              </h1>
              <p style="margin:4px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">
                Bureau of Fire Protection
              </p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px 40px 32px;">
              <p style="margin:0 0 8px;font-size:13px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;font-weight:600;">
                Password Reset
              </p>
              <h2 style="margin:0 0 20px;font-size:24px;color:#111827;font-weight:700;">
                Your Temporary Password &#128273;
              </h2>
              <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.7;">
                Dear <strong>${name}</strong>,
              </p>
              <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.7;">
                An administrator has reset your password for the <strong>MySunog Fire Safety Management System</strong>.
                Your temporary password is shown below:
              </p>
              <!-- Temp Password Box -->
              <div style="background:#f9fafb;border:2px dashed #d1d5db;border-radius:10px;padding:20px 24px;text-align:center;margin:0 0 24px;">
                <p style="margin:0 0 6px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;">Temporary Password</p>
                <p style="margin:0;font-size:28px;font-weight:800;color:#dc2626;letter-spacing:4px;font-family:'Courier New',monospace;">
                  ${tempPassword}
                </p>
              </div>
              <p style="margin:0 0 24px;font-size:14px;color:#6b7280;line-height:1.7;">
                &#9888;&#65039; For your security, please log in and <strong>change your password immediately</strong> after signing in.
                This temporary password should not be shared with anyone.
              </p>
              <!-- CTA Button -->
              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td align="center">
                    <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/login"
                       style="display:inline-block;background:linear-gradient(135deg,#dc2626,#ea580c);color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 36px;border-radius:8px;letter-spacing:0.3px;">
                      Log In to MySunog
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Divider -->
          <tr>
            <td style="padding:0 40px;"><hr style="border:none;border-top:1px solid #e5e7eb;margin:0;" /></td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px 36px;text-align:center;">
              <p style="margin:0 0 4px;font-size:13px;color:#6b7280;line-height:1.6;">
                If you did not request a password reset, please contact your BFP administrator immediately.
              </p>
              <p style="margin:0;font-size:13px;color:#9ca3af;">
                &copy; ${new Date().getFullYear()} MySunog &mdash; Bureau of Fire Protection &nbsp;|&nbsp; Fire Safety Management System
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();

    try {
      const { error } = await this.resend.emails.send({
        from: this.from,
        to: user.email,
        subject: 'Your MySunog Temporary Password',
        html,
      });

      if (error) {
        this.logger.error(`Resend error sending temp password to ${user.email}: ${JSON.stringify(error)}`);
      } else {
        this.logger.log(`Temp password email sent to ${user.email}`);
      }
    } catch (err) {
      this.logger.error(`Failed to send temp password email to ${user.email}`, err);
    }
  }

  /**
   * Send a formal status-update email to an FSIC or FSEC applicant.
   */
  async sendPermitStatusUpdate(opts: {
    applicantEmail: string;
    applicantName?: string;
    permitType: 'FSIC' | 'FSEC';
    businessName: string;
    status: string;
    adminRemarks?: string;
    inspectionDate?: string;   // ISO string or friendly date string
    inspectionTime?: string;
    certificateUrl?: string;
  }): Promise<void> {
    const {
      applicantEmail,
      applicantName,
      permitType,
      businessName,
      status,
      adminRemarks,
      inspectionDate,
      inspectionTime,
      certificateUrl,
    } = opts;

    const name = applicantName || 'Valued Applicant';
    const fullPermitName =
      permitType === 'FSIC'
        ? 'Fire Safety Inspection Certificate (FSIC)'
        : 'Fire Safety Evaluation Clearance (FSEC)';

    // ── Status meta ──────────────────────────────────────────────────
    const statusMeta: Record<string, { label: string; color: string; bg: string; icon: string; body: string }> = {
      submitted: {
        label: 'Application Received',
        color: '#1d4ed8',
        bg: '#eff6ff',
        icon: '&#128228;',
        body: `We have successfully received your ${fullPermitName} application for <strong>${businessName}</strong>. Our team will review your documents and update you on the next steps shortly.`,
      },
      under_review: {
        label: 'Under Review',
        color: '#b45309',
        bg: '#fffbeb',
        icon: '&#128269;',
        body: `Your ${fullPermitName} application for <strong>${businessName}</strong> is currently being reviewed by our BFP officers. Please ensure all submitted documents are complete and accurate. You will be notified once the review is complete.`,
      },
      revision_required: {
        label: 'Revision Required',
        color: '#c2410c',
        bg: '#fff7ed',
        icon: '&#9998;&#65039;',
        body: `Your ${fullPermitName} application for <strong>${businessName}</strong> requires revision before it can proceed. Please review the remarks below and resubmit the corrected documents at the BFP office or through the system.`,
      },
      approved: {
        label: 'Approved',
        color: '#15803d',
        bg: '#f0fdf4',
        icon: '&#9989;',
        body: `Congratulations! Your ${fullPermitName} application for <strong>${businessName}</strong> has been <strong>approved</strong> by the BFP administrator. An inspection will be scheduled as part of the certification process.`,
      },
      issued: {
        label: 'Certificate Issued',
        color: '#15803d',
        bg: '#f0fdf4',
        icon: '&#127881;',
        body: `Your ${fullPermitName} for <strong>${businessName}</strong> has been <strong>officially issued</strong>. You may download or claim your certificate at the BFP Malvar Fire Station.`,
      },
      released: {
        label: 'Certificate Released',
        color: '#6d28d9',
        bg: '#f5f3ff',
        icon: '&#127873;',
        body: `Your ${fullPermitName} for <strong>${businessName}</strong> has been <strong>released</strong>. The certificate is now ready for pickup at the BFP Malvar Fire Station, or accessible via the MySunog system.`,
      },
      rejected: {
        label: 'Application Rejected',
        color: '#b91c1c',
        bg: '#fef2f2',
        icon: '&#10060;',
        body: `We regret to inform you that your ${fullPermitName} application for <strong>${businessName}</strong> has been <strong>rejected</strong>. Please review the remarks below. You may reapply after addressing the noted concerns.`,
      },
      // FSEC-specific
      pending: {
        label: 'Application Received',
        color: '#1d4ed8',
        bg: '#eff6ff',
        icon: '&#128228;',
        body: `We have successfully received your ${fullPermitName} application for <strong>${businessName}</strong>. Our team will review your documents and update you on the next steps shortly.`,
      },
      completed: {
        label: 'Inspection Completed',
        color: '#15803d',
        bg: '#f0fdf4',
        icon: '&#9989;',
        body: `The inspection for your ${fullPermitName} application for <strong>${businessName}</strong> has been <strong>completed</strong>. Our officers will finalize the certificate and notify you once it is ready.`,
      },
    };

    const meta = statusMeta[status] ?? {
      label: status.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
      color: '#374151',
      bg: '#f9fafb',
      icon: '&#128203;',
      body: `Your ${fullPermitName} application for <strong>${businessName}</strong> status has been updated to <strong>${status}</strong>.`,
    };

    const subjectLine = `[MySunog] ${fullPermitName} Update — ${meta.label}`;

    // ── Remarks block ────────────────────────────────────────────────
    const remarksBlock = adminRemarks
      ? `<div style="background:#f9fafb;border-left:4px solid ${meta.color};border-radius:0 8px 8px 0;padding:16px 20px;margin:24px 0;">
           <p style="margin:0 0 4px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;font-weight:600;">BFP Remarks</p>
           <p style="margin:0;font-size:14px;color:#374151;line-height:1.7;">${adminRemarks}</p>
         </div>`
      : '';

    // ── Inspection schedule block ────────────────────────────────────
    let scheduleBlock = '';
    if (inspectionDate) {
      const dateLabel = inspectionDate;
      const timeLabel = inspectionTime ? ` at ${inspectionTime}` : '';
      scheduleBlock = `
        <div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:16px 20px;margin:24px 0;">
          <p style="margin:0 0 6px;font-size:12px;color:#92400e;text-transform:uppercase;letter-spacing:1px;font-weight:600;">&#128197; Scheduled Inspection</p>
          <p style="margin:0;font-size:15px;font-weight:700;color:#92400e;">${dateLabel}${timeLabel}</p>
          <p style="margin:4px 0 0;font-size:13px;color:#78350f;">Please ensure that a responsible person is present at the establishment during the inspection.</p>
        </div>`;
    }

    // ── Certificate download block ───────────────────────────────────
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const certBlock = certificateUrl
      ? `<table cellpadding="0" cellspacing="0" width="100%" style="margin:24px 0;">
           <tr>
             <td align="center">
               <a href="${frontendUrl}${certificateUrl}"
                  style="display:inline-block;background:linear-gradient(135deg,#15803d,#16a34a);color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 28px;border-radius:8px;letter-spacing:0.3px;">
                 &#128196; Download Certificate
               </a>
             </td>
           </tr>
         </table>`
      : '';

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>${subjectLine}</title>
</head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#dc2626,#ea580c);padding:36px 40px;text-align:center;">
              <p style="margin:0;font-size:30px;">&#128293;</p>
              <h1 style="margin:8px 0 0;color:#ffffff;font-size:22px;font-weight:700;letter-spacing:0.5px;">
                MySunog Fire Safety System
              </h1>
              <p style="margin:4px 0 0;color:rgba(255,255,255,0.85);font-size:13px;">
                Bureau of Fire Protection &mdash; Malvar, Batangas
              </p>
            </td>
          </tr>

          <!-- Status badge row -->
          <tr>
            <td style="background:${meta.bg};padding:20px 40px;border-bottom:1px solid #e5e7eb;">
              <table cellpadding="0" cellspacing="0">
                <tr>
                  <td style="padding-right:14px;font-size:28px;">${meta.icon}</td>
                  <td>
                    <p style="margin:0;font-size:11px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;font-weight:600;">${permitType} Application Status</p>
                    <p style="margin:4px 0 0;font-size:20px;font-weight:800;color:${meta.color};">${meta.label}</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:36px 40px 28px;">
              <p style="margin:0 0 16px;font-size:15px;color:#374151;line-height:1.7;">
                Dear <strong>${name}</strong>,
              </p>
              <p style="margin:0 0 20px;font-size:15px;color:#374151;line-height:1.7;">
                ${meta.body}
              </p>

              <!-- Application summary card -->
              <table cellpadding="0" cellspacing="0" width="100%" style="background:#f9fafb;border-radius:10px;border:1px solid #e5e7eb;margin:0 0 20px;">
                <tr>
                  <td style="padding:18px 20px;">
                    <p style="margin:0 0 10px;font-size:12px;color:#6b7280;text-transform:uppercase;letter-spacing:1px;font-weight:600;">Application Summary</p>
                    <table cellpadding="0" cellspacing="0" width="100%">
                      <tr>
                        <td style="font-size:13px;color:#6b7280;padding:4px 0;width:40%;">Application Type</td>
                        <td style="font-size:13px;color:#111827;font-weight:600;padding:4px 0;">${fullPermitName}</td>
                      </tr>
                      <tr>
                        <td style="font-size:13px;color:#6b7280;padding:4px 0;">Business / Establishment</td>
                        <td style="font-size:13px;color:#111827;font-weight:600;padding:4px 0;">${businessName}</td>
                      </tr>
                      <tr>
                        <td style="font-size:13px;color:#6b7280;padding:4px 0;">Current Status</td>
                        <td style="padding:4px 0;">
                          <span style="display:inline-block;background:${meta.bg};color:${meta.color};font-size:12px;font-weight:700;padding:3px 10px;border-radius:20px;border:1px solid ${meta.color}33;">
                            ${meta.label}
                          </span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>

              ${remarksBlock}
              ${scheduleBlock}
              ${certBlock}

              <!-- CTA -->
              <table cellpadding="0" cellspacing="0" width="100%" style="margin-top:20px;">
                <tr>
                  <td align="center">
                    <a href="${frontendUrl}/login"
                       style="display:inline-block;background:linear-gradient(135deg,#dc2626,#ea580c);color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:14px 36px;border-radius:8px;letter-spacing:0.3px;">
                      View Application Status
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Divider -->
          <tr>
            <td style="padding:0 40px;"><hr style="border:none;border-top:1px solid #e5e7eb;margin:0;" /></td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px 36px;text-align:center;">
              <p style="margin:0 0 6px;font-size:13px;color:#374151;font-weight:600;">BFP Malvar Fire Station</p>
              <p style="margin:0 0 4px;font-size:12px;color:#6b7280;">Municipality of Malvar, Batangas, Philippines</p>
              <p style="margin:0;font-size:12px;color:#9ca3af;">
                &copy; ${new Date().getFullYear()} MySunog &mdash; Bureau of Fire Protection &nbsp;|&nbsp; Fire Safety Management System
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
    `.trim();

    try {
      const { error } = await this.resend.emails.send({
        from: this.from,
        to: applicantEmail,
        subject: subjectLine,
        html,
      });
      if (error) {
        this.logger.error(`Resend error sending permit status to ${applicantEmail}: ${JSON.stringify(error)}`);
      } else {
        this.logger.log(`Permit status email (${status}) sent to ${applicantEmail}`);
      }
    } catch (err) {
      this.logger.error(`Failed to send permit status email to ${applicantEmail}`, err);
    }
  }
}
