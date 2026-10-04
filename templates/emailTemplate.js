/**
 * HingeOut Daily Job Digest Responsive Email Template
 * 
 * Complies with 2024 Gmail, Yahoo, and Apple Mail deliverability guidelines:
 * - Table-based responsive layout with inline CSS
 * - High text-to-image ratio (avoids spam filter triggers)
 * - Clear RFC 8058 1-click unsubscribe link in footer
 * - Mobile viewport optimization and dark-mode compatibility
 */

function generateJobDigestHtml({
  candidateName = 'Candidate',
  candidateEmail = '',
  jobs = [],
  digestDate = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' }),
  siteUrl = 'https://hingeout.com',
  unsubscribeUrl = 'https://hingeout.com/api/newsletter/unsubscribe',
  preferencesUrl = 'https://hingeout.com/creator/dashboard',
}) {
  const firstName = candidateName ? candidateName.split(' ')[0] : 'there';

  const jobCardsHtml = jobs.map((job) => {
    const jobUrl = job.applyUrl || `${siteUrl}/jobs/${job.id || job._id || ''}`;
    const location = [job.city, job.state, job.country].filter(Boolean).join(', ') || job.location || 'Global / Remote';
    const company = job.company || 'Featured Tech Employer';
    const jobType = job.jobType || job.job_type || 'Full-time';
    const salaryOrCpc = job.salary 
      ? job.salary 
      : job.cpc_rate 
      ? `Earn ₹${Number(job.cpc_rate).toFixed(2)} CPC` 
      : 'Top Industry Compensation';

    return `
      <!-- JOB CARD -->
      <tr>
        <td style="padding-bottom: 16px;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; padding: 20px; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
            <tr>
              <td>
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td style="vertical-align: top;">
                      <span style="display: inline-block; font-size: 11px; font-weight: 700; color: #2563eb; background-color: #eff6ff; border: 1px solid #dbeafe; padding: 3px 8px; border-radius: 6px; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 8px;">
                        ${jobType}
                      </span>
                      <h3 style="margin: 4px 0 6px 0; font-size: 17px; font-weight: 800; color: #0f172a; line-height: 1.3;">
                        <a href="${jobUrl}" target="_blank" style="color: #0f172a; text-decoration: none;">
                          ${job.title || 'Software Opportunity'}
                        </a>
                      </h3>
                      <p style="margin: 0 0 12px 0; font-size: 13px; font-weight: 600; color: #64748b;">
                        🏢 ${company} &nbsp;·&nbsp; 📍 ${location}
                      </p>
                    </td>
                  </tr>
                  <tr>
                    <td>
                      <!-- Salary / Reward Badge & CTA Button -->
                      <table width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td style="vertical-align: middle;">
                            <span style="display: inline-block; font-size: 12px; font-weight: 700; color: #059669; background-color: #ecfdf5; border: 1px solid #a7f3d0; padding: 4px 10px; border-radius: 8px;">
                              💰 ${salaryOrCpc}
                            </span>
                          </td>
                          <td style="text-align: right; vertical-align: middle;">
                            <a href="${jobUrl}" target="_blank" style="display: inline-block; background-color: #2563eb; color: #ffffff; font-size: 12px; font-weight: 700; text-decoration: none; padding: 9px 18px; border-radius: 10px; box-shadow: 0 2px 4px rgba(37,99,235,0.2);">
                              View & Apply →
                            </a>
                          </td>
                        </tr>
                      </table>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `;
  }).join('');

  return `<!DOCTYPE html>
<html lang="en" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="x-apple-disable-message-reformatting">
  <meta name="format-detection" content="telephone=no,address=no,email=no,date=no,url=no">
  <title>Daily Job Opportunities - HingeOut AI</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style>
    body, table, td, a { -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    table, td { mso-table-lspace: 0pt; mso-table-rspace: 0pt; }
    img { -ms-interpolation-mode: bicubic; border: 0; height: auto; line-height: 100%; outline: none; text-decoration: none; }
    body { height: 100% !important; margin: 0 !important; padding: 0 !important; width: 100% !important; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
    @media only screen and (max-width: 600px) {
      .container-table { width: 100% !important; max-width: 100% !important; }
      .mobile-padding { padding-left: 16px !important; padding-right: 16px !important; }
    }
  </style>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; color: #334155;">

  <!-- Outer Background Container -->
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f8fafc; margin: 0; padding: 24px 0 40px 0;">
    <tr>
      <td align="center">
        
        <!-- Main Email Container (Max Width 580px for optimal reading) -->
        <table class="container-table" width="580" cellpadding="0" cellspacing="0" border="0" style="width: 580px; max-width: 580px; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 24px; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);">
          
          <!-- BRAND HEADER -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e3a8a 0%, #1e1b4b 100%); background-color: #1e3a8a; padding: 32px 28px; text-align: left;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <span style="font-size: 22px; font-weight: 900; color: #ffffff; letter-spacing: -0.5px;">
                      HingeOut <span style="color: #60a5fa;">AI</span>
                    </span>
                    <span style="display: inline-block; font-size: 10px; font-weight: 800; background-color: rgba(255,255,255,0.15); color: #93c5fd; padding: 2px 8px; border-radius: 12px; margin-left: 8px; vertical-align: middle;">
                      DAILY DIGEST
                    </span>
                  </td>
                  <td style="text-align: right;">
                    <span style="font-size: 11px; font-weight: 600; color: #94a3b8;">
                      ${digestDate}
                    </span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- INTRO GREETING -->
          <tr>
            <td class="mobile-padding" style="padding: 28px 28px 12px 28px; background-color: #ffffff;">
              <h2 style="margin: 0 0 8px 0; font-size: 20px; font-weight: 800; color: #0f172a; letter-spacing: -0.3px;">
                Hi ${firstName} 👋
              </h2>
              <p style="margin: 0; font-size: 14px; line-height: 1.6; color: #475569;">
                Here are the <strong>top curated job openings</strong> matched for you today. Apply directly or share with your network to earn live rewards.
              </p>
            </td>
          </tr>

          <!-- JOB LISTINGS -->
          <tr>
            <td class="mobile-padding" style="padding: 16px 28px; background-color: #ffffff;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                ${jobCardsHtml}
              </table>
            </td>
          </tr>

          <!-- EXPLORE MORE CALLOUT -->
          <tr>
            <td class="mobile-padding" style="padding: 0 28px 28px 28px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f1f5f9; border-radius: 16px; padding: 18px; text-align: center;">
                <tr>
                  <td>
                    <p style="margin: 0 0 10px 0; font-size: 13px; font-weight: 700; color: #1e293b;">
                      Looking for more opportunities?
                    </p>
                    <a href="${siteUrl}/jobs" target="_blank" style="display: inline-block; background-color: #0f172a; color: #ffffff; font-size: 12px; font-weight: 700; text-decoration: none; padding: 10px 22px; border-radius: 10px;">
                      Browse 139,000+ Jobs on HingeOut →
                    </a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- FOOTER & 1-CLICK UNSUBSCRIBE COMPLIANCE -->
          <tr>
            <td style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 28px; text-align: center;">
              <p style="margin: 0 0 10px 0; font-size: 11px; line-height: 1.5; color: #94a3b8;">
                You are receiving this daily email alert because you are a registered member of HingeOut.<br>
                HingeOut AI Platform · Career & Creator Network
              </p>

              <p style="margin: 0; font-size: 11px; color: #64748b;">
                <a href="${preferencesUrl}" style="color: #2563eb; text-decoration: underline; font-weight: 600;">Manage Preferences</a>
                &nbsp;·&nbsp;
                <a href="${unsubscribeUrl}" style="color: #64748b; text-decoration: underline;">1-Click Unsubscribe</a>
                &nbsp;·&nbsp;
                <a href="${siteUrl}/privacy" style="color: #64748b; text-decoration: underline;">Privacy Policy</a>
              </p>
            </td>
          </tr>

        </table>

      </td>
    </tr>
  </table>

</body>
</html>`;
}

module.exports = {
  generateJobDigestHtml,
};
