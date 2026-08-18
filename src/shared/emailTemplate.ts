import config from '../config';
import {
  IConsultationBookingEmail,
  IConsultationReportEmail,
  ICreateAccount,
  IInvoiceEmail,
  IReportStatusEmail,
  IResetPassword,
} from '../types/emailTamplate';

const getProjectName = () => config.branding.projectName || 'Fixpair';

const getLogoUrl = () => {
  // If a public HTTPS CDN / Cloud URL is explicitly configured, use it
  if (
    config.branding.logoUrl &&
    config.branding.logoUrl.startsWith('https://')
  ) {
    return config.branding.logoUrl;
  }
  // Otherwise use inline CID attachment so email clients (Gmail/Outlook) always display the image
  return 'cid:fixpair-logo';
};

const baseTemplate = (title: string, bodyContent: string) => {
  const projectName = getProjectName();
  const logoUrl = getLogoUrl();
  const year = new Date().getFullYear();

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${projectName}</title>
    <style>
      body {
        margin: 0;
        padding: 0;
        background-color: #ffffff;
      }

      .wrapper {
        width: 100%;
        table-layout: fixed;
        background-color: #ffffff;
        padding: 24px 0;
      }

      .main {
        width: 100%;
        max-width: 480px;
        margin: 0 auto;
        background-color: #050816;
        border-radius: 16px;
        border: 1px solid #111827;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Arial, sans-serif;
        color: #e5e7eb;
      }

      .header {
        padding: 32px 24px 16px;
        text-align: center;
      }

      .brand-name {
        font-size: 22px;
        font-weight: 600;
        letter-spacing: 0.04em;
        color: #f9fafb;
      }

      .logo-wrapper {
        display: inline-block;
        padding: 8px 18px;
        background-color: #ffffff;
        border-radius: 12px;
        margin: 0 auto 16px;
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.25);
      }

      .logo {
        display: block;
        margin: 0 auto;
        max-width: 125px;
        height: auto;
      }

      .header-divider {
        margin: 12px auto 0;
        width: 100%;
        max-width: 80%;
        height: 1px;
        background: linear-gradient(to right, transparent, #1d4ed8, transparent);
      }

      .content {
        padding: 8px 24px 24px;
        font-size: 14px;
        line-height: 1.6;
        text-align: center;
      }

      .content-title {
        font-size: 22px;
        font-weight: 600;
        margin: 0 0 12px;
        color: #f9fafb;
      }

      .otp-box {
        display: inline-block;
        margin: 24px 0 8px;
        padding: 14px 32px;
        border-radius: 9999px;
        background-color: #2563eb;
        color: #ffffff;
        font-size: 24px;
        font-weight: 600;
        letter-spacing: 0.25em;
      }

      .info-card {
        margin: 16px 0;
        padding: 14px 18px;
        border-radius: 10px;
        background-color: #0c1222;
        border: 1px solid #1e293b;
        text-align: left;
      }

      .info-title {
        margin: 0 0 8px;
        color: #f9fafb;
        font-weight: 600;
        font-size: 13px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
      }

      .info-row {
        margin: 0 0 6px;
        color: #cbd5e1;
        font-size: 13px;
      }

      .info-label {
        color: #94a3b8;
      }

      .action-btn {
        display: inline-block;
        margin: 20px 0 10px;
        padding: 12px 28px;
        border-radius: 8px;
        background-color: #2563eb;
        color: #ffffff;
        font-size: 14px;
        font-weight: 600;
        text-decoration: none;
      }

      .footer {
        padding: 16px 24px 24px;
        font-size: 12px;
        color: #9ca3af;
        text-align: center;
        border-top: 1px solid #111827;
      }

      @media screen and (max-width: 600px) {
        .main {
          max-width: 100%;
          border-radius: 0;
          border-left: none;
          border-right: none;
        }

        .content {
          padding: 8px 16px 24px;
        }
      }
    </style>
  </head>
  <body>
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" class="wrapper">
      <tr>
        <td align="center">
          <table role="presentation" cellpadding="0" cellspacing="0" border="0" class="main">
            <tr>
              <td class="header">
                ${
                  logoUrl
                    ? `<div class="logo-wrapper"><img src="${logoUrl}" alt="${projectName} logo" class="logo" /></div>`
                    : `<div class="brand-name">${projectName}</div>`
                }
                <div class="header-divider"></div>
              </td>
            </tr>
            <tr>
              <td class="content">
                <h1 class="content-title">${title}</h1>
                ${bodyContent}
              </td>
            </tr>
            <tr>
              <td class="footer">
                <div>You are receiving this email from ${projectName}.</div>
                <div>© ${year} ${projectName}. All rights reserved.</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
};

const createAccount = (values: ICreateAccount) => {
  const projectName = getProjectName();

  const bodyContent = `
    <p style="margin: 0 0 10px; color: #d1d5db;">
      Hey ${values.name}, use the one-time passcode below to complete verification of your ${projectName} account.
    </p>
    <div class="otp-box">${values.otp}</div>
    <p style="margin: 8px 0 4px; color: #9ca3af;">
      Code expires in 3 minutes.
    </p>
    <p style="margin: 16px 0 0; color: #6b7280;">
      If you did not request this, ignore this email.
    </p>
  `;

  const data = {
    to: values.email,
    subject: `Verify your ${projectName} account`,
    html: baseTemplate('Verify your account', bodyContent),
  };

  return data;
};

const resetPassword = (values: IResetPassword) => {
  const projectName = getProjectName();

  const bodyContent = `
    <p style="margin: 0 0 10px; color: #d1d5db;">
      Use the one-time passcode below to reset the password for your ${projectName} account.
    </p>
    <div class="otp-box">${values.otp}</div>
    <p style="margin: 8px 0 4px; color: #9ca3af;">
      Code expires in 3 minutes.
    </p>
    <p style="margin: 16px 0 0; color: #6b7280;">
      If you did not request this, ignore this email.
    </p>
  `;

  const data = {
    to: values.email,
    subject: `Reset your ${projectName} password`,
    html: baseTemplate('Reset your password', bodyContent),
  };

  return data;
};

const reportStatusUpdate = (values: IReportStatusEmail) => {
  const projectName = getProjectName();

  const decisionLabel =
    values.decision === 'resolved' ? 'Report Resolved' : 'Report Dismissed';

  const serviceName = values.serviceName || values.productName;
  const serviceId = values.serviceId || values.productId || values.consultationId;
  const serviceDetails = values.serviceDetails || values.productDetails;
  const consultantName = values.consultantName;

  const hasDetails = serviceName || serviceId || serviceDetails || consultantName;

  const bodyContent = `
    <p style="margin: 0 0 10px; color: #d1d5db;">
      We are writing to inform you about the outcome of a report related to your activity or consultation on ${projectName}.
    </p>
    <p style="margin: 8px 0; color: #d1d5db;">
      Status: <strong style="color: #f9fafb;">${decisionLabel}</strong>
    </p>
    <p style="margin: 8px 0; color: #d1d5db;">
      Explanation from our team:
    </p>
    <p style="margin: 8px 0 16px; color: #9ca3af;">
      ${values.explanation}
    </p>
    ${
      hasDetails
        ? `
    <div class="info-card">
      <p class="info-title">Reported Service Details</p>
      ${
        serviceName
          ? `<p class="info-row"><span class="info-label">Service:</span> ${serviceName}</p>`
          : ''
      }
      ${
        consultantName
          ? `<p class="info-row"><span class="info-label">Consultant:</span> ${consultantName}</p>`
          : ''
      }
      ${
        serviceId
          ? `<p class="info-row"><span class="info-label">ID:</span> ${serviceId}</p>`
          : ''
      }
      ${
        serviceDetails
          ? `<p class="info-row" style="margin-top: 4px; color: #94a3b8;">${serviceDetails}</p>`
          : ''
      }
    </div>
    `
        : ''
    }
    <p style="margin: 16px 0 0; color: #6b7280;">
      If you have any questions about this decision, you can contact our support team from your dashboard.
    </p>
  `;

  const data = {
    to: values.email,
    subject: `${projectName} report status update`,
    html: baseTemplate('Report status update', bodyContent),
  };

  return data;
};

const consultationBooked = (values: IConsultationBookingEmail) => {
  const projectName = getProjectName();

  const formattedDate = values.date
    ? new Date(values.date).toLocaleDateString()
    : 'Immediate / On Demand';

  const bodyContent = `
    <p style="margin: 0 0 10px; color: #d1d5db;">
      Hello ${values.userName}, your consultation session on ${projectName} has been successfully scheduled.
    </p>
    <div class="info-card">
      <p class="info-title">Session Details</p>
      <p class="info-row"><span class="info-label">Consultant:</span> ${values.consultantName}</p>
      <p class="info-row"><span class="info-label">Booking Type:</span> ${values.bookingType}</p>
      <p class="info-row"><span class="info-label">Date:</span> ${formattedDate}</p>
      ${
        values.startTime
          ? `<p class="info-row"><span class="info-label">Time:</span> ${values.startTime}</p>`
          : ''
      }
    </div>
    <p style="margin: 16px 0 0; color: #9ca3af;">
      Please ensure you are ready and online ahead of your scheduled session.
    </p>
  `;

  const data = {
    to: values.userEmail,
    subject: `Consultation Confirmed with ${values.consultantName} - ${projectName}`,
    html: baseTemplate('Consultation Confirmed', bodyContent),
  };

  return data;
};

const consultationReportReady = (values: IConsultationReportEmail) => {
  const projectName = getProjectName();

  const bodyContent = `
    <p style="margin: 0 0 10px; color: #d1d5db;">
      Hello ${values.userName}, the consultation summary report for your session with <strong>${values.consultantName}</strong> is now available.
    </p>
    <div class="info-card">
      <p class="info-title">Consultation Summary</p>
      <p class="info-row"><span class="info-label">Consultant:</span> ${values.consultantName}</p>
      <p class="info-row"><span class="info-label">Consultation ID:</span> ${values.consultationId}</p>
      ${
        values.notes
          ? `<p class="info-row" style="margin-top: 6px;"><span class="info-label">Consultant Notes:</span><br/><span style="color: #cbd5e1;">${values.notes}</span></p>`
          : ''
      }
    </div>
    ${
      values.pdfUrl
        ? `<p style="margin: 20px 0 10px;"><a href="${values.pdfUrl}" class="action-btn">View / Download Report PDF</a></p>`
        : ''
    }
    <p style="margin: 16px 0 0; color: #6b7280;">
      You can also access this report at any time directly from your ${projectName} dashboard.
    </p>
  `;

  const data = {
    to: values.userEmail,
    subject: `Your Consultation Report is Ready - ${projectName}`,
    html: baseTemplate('Consultation Report Ready', bodyContent),
  };

  return data;
};

const invoiceReceipt = (values: IInvoiceEmail) => {
  const projectName = getProjectName();

  const bodyContent = `
    <p style="margin: 0 0 10px; color: #d1d5db;">
      Hello ${values.userName}, thank you for using ${projectName}. Your payment for the consultation with <strong>${values.consultantName}</strong> has been processed.
    </p>
    <div class="info-card">
      <p class="info-title">Invoice Receipt</p>
      <p class="info-row"><span class="info-label">Invoice Number:</span> ${values.invoiceNumber}</p>
      <p class="info-row"><span class="info-label">Consultant:</span> ${values.consultantName}</p>
      <p class="info-row"><span class="info-label">Total Amount:</span> $${values.totalAmount.toFixed(2)}</p>
    </div>
    ${
      values.pdfUrl
        ? `<p style="margin: 20px 0 10px;"><a href="${values.pdfUrl}" class="action-btn">Download Invoice PDF</a></p>`
        : ''
    }
    <p style="margin: 16px 0 0; color: #6b7280;">
      Thank you for choosing ${projectName} Live Consultancy!
    </p>
  `;

  const data = {
    to: values.userEmail,
    subject: `Invoice #${values.invoiceNumber} - ${projectName}`,
    html: baseTemplate('Payment Receipt', bodyContent),
  };

  return data;
};

export const emailTemplate = {
  createAccount,
  resetPassword,
  reportStatusUpdate,
  consultationBooked,
  consultationReportReady,
  invoiceReceipt,
};

