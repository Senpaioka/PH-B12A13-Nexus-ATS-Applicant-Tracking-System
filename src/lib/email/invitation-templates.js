/**
 * Team Invitation Email Templates
 * Professional HTML email templates for team member invitations
 */

/**
 * Generates HTML email template for team invitation
 * @param {Object} invitationData - Invitation data
 * @returns {string} HTML email template
 */
export function generateInvitationEmailHTML(invitationData) {
  const {
    inviterName,
    organizationName,
    role,
    message,
    acceptanceUrl,
    expiresAt
  } = invitationData;

  const expiryDate = new Date(expiresAt).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Team Invitation - ${organizationName}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 600px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f8f9fa;
        }
        .email-container {
            background-color: #ffffff;
            border-radius: 8px;
            padding: 40px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
        }
        .logo {
            font-size: 24px;
            font-weight: bold;
            color: #2563eb;
            margin-bottom: 10px;
        }
        .title {
            font-size: 28px;
            font-weight: 600;
            color: #1f2937;
            margin-bottom: 10px;
        }
        .subtitle {
            font-size: 16px;
            color: #6b7280;
            margin-bottom: 30px;
        }
        .content {
            margin-bottom: 30px;
        }
        .invitation-details {
            background-color: #f3f4f6;
            border-radius: 6px;
            padding: 20px;
            margin: 20px 0;
        }
        .detail-row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 10px;
            padding: 5px 0;
        }
        .detail-label {
            font-weight: 600;
            color: #374151;
        }
        .detail-value {
            color: #6b7280;
        }
        .role-badge {
            background-color: #dbeafe;
            color: #1e40af;
            padding: 4px 12px;
            border-radius: 20px;
            font-size: 14px;
            font-weight: 500;
        }
        .message-box {
            background-color: #fef3c7;
            border-left: 4px solid #f59e0b;
            padding: 15px;
            margin: 20px 0;
            border-radius: 0 6px 6px 0;
        }
        .message-label {
            font-weight: 600;
            color: #92400e;
            margin-bottom: 5px;
        }
        .message-text {
            color: #78350f;
            font-style: italic;
        }
        .cta-button {
            display: inline-block;
            background-color: #2563eb;
            color: #ffffff;
            text-decoration: none;
            padding: 14px 28px;
            border-radius: 6px;
            font-weight: 600;
            font-size: 16px;
            text-align: center;
            margin: 20px 0;
            transition: background-color 0.2s;
        }
        .cta-button:hover {
            background-color: #1d4ed8;
        }
        .cta-container {
            text-align: center;
            margin: 30px 0;
        }
        .expiry-notice {
            background-color: #fef2f2;
            border: 1px solid #fecaca;
            border-radius: 6px;
            padding: 15px;
            margin: 20px 0;
        }
        .expiry-text {
            color: #dc2626;
            font-size: 14px;
            font-weight: 500;
        }
        .footer {
            margin-top: 40px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            text-align: center;
            color: #6b7280;
            font-size: 14px;
        }
        .footer-links {
            margin-top: 15px;
        }
        .footer-link {
            color: #2563eb;
            text-decoration: none;
            margin: 0 10px;
        }
        .footer-link:hover {
            text-decoration: underline;
        }
        @media (max-width: 600px) {
            body {
                padding: 10px;
            }
            .email-container {
                padding: 20px;
            }
            .title {
                font-size: 24px;
            }
            .detail-row {
                flex-direction: column;
                gap: 5px;
            }
        }
    </style>
</head>
<body>
    <div class="email-container">
        <div class="header">
            <div class="logo">Nexus ATS</div>
            <h1 class="title">You're Invited!</h1>
            <p class="subtitle">Join ${organizationName} as a team member</p>
        </div>

        <div class="content">
            <p>Hi there,</p>
            <p><strong>${inviterName}</strong> has invited you to join <strong>${organizationName}</strong> on Nexus ATS.</p>
            
            <div class="invitation-details">
                <div class="detail-row">
                    <span class="detail-label">Organization:</span>
                    <span class="detail-value">${organizationName}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Role:</span>
                    <span class="role-badge">${role}</span>
                </div>
                <div class="detail-row">
                    <span class="detail-label">Invited by:</span>
                    <span class="detail-value">${inviterName}</span>
                </div>
            </div>

            ${message ? `
            <div class="message-box">
                <div class="message-label">Personal Message:</div>
                <div class="message-text">"${message}"</div>
            </div>
            ` : ''}

            <div class="cta-container">
                <a href="${acceptanceUrl}" class="cta-button">Accept Invitation</a>
            </div>

            <div class="expiry-notice">
                <div class="expiry-text">
                    ⏰ This invitation expires on ${expiryDate}
                </div>
            </div>

            <p>As a <strong>${role}</strong>, you'll be able to:</p>
            <ul>
                ${getRolePermissions(role).map(permission => `<li>${permission}</li>`).join('')}
            </ul>

            <p>If you have any questions about this invitation, please contact ${inviterName} directly.</p>
        </div>

        <div class="footer">
            <p>This invitation was sent by ${organizationName} using Nexus ATS.</p>
            <div class="footer-links">
                <a href="#" class="footer-link">Privacy Policy</a>
                <a href="#" class="footer-link">Terms of Service</a>
                <a href="#" class="footer-link">Support</a>
            </div>
            <p style="margin-top: 15px; font-size: 12px; color: #9ca3af;">
                If you didn't expect this invitation, you can safely ignore this email.
            </p>
        </div>
    </div>
</body>
</html>`;
}

/**
 * Generates plain text email template for team invitation
 * @param {Object} invitationData - Invitation data
 * @returns {string} Plain text email template
 */
export function generateInvitationEmailText(invitationData) {
  const {
    inviterName,
    organizationName,
    role,
    message,
    acceptanceUrl,
    expiresAt
  } = invitationData;

  const expiryDate = new Date(expiresAt).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return `
TEAM INVITATION - ${organizationName}

Hi there,

${inviterName} has invited you to join ${organizationName} on Nexus ATS.

INVITATION DETAILS:
- Organization: ${organizationName}
- Role: ${role}
- Invited by: ${inviterName}

${message ? `PERSONAL MESSAGE:\n"${message}"\n` : ''}

To accept this invitation, please visit:
${acceptanceUrl}

IMPORTANT: This invitation expires on ${expiryDate}

As a ${role}, you'll be able to:
${getRolePermissions(role).map(permission => `- ${permission}`).join('\n')}

If you have any questions about this invitation, please contact ${inviterName} directly.

---
This invitation was sent by ${organizationName} using Nexus ATS.

If you didn't expect this invitation, you can safely ignore this email.
`;
}

/**
 * Gets role-specific permissions description
 * @param {string} role - Team role
 * @returns {Array<string>} List of permissions
 */
function getRolePermissions(role) {
  const permissions = {
    'Admin': [
      'Manage team members and invitations',
      'Configure organization settings',
      'Access all jobs and applications',
      'Manage interview schedules',
      'View analytics and reports'
    ],
    'Recruiter': [
      'Create and manage job postings',
      'Review and manage applications',
      'Schedule interviews with candidates',
      'Collaborate with hiring managers',
      'Access candidate database'
    ],
    'Interviewer': [
      'Conduct interviews with candidates',
      'Provide feedback and ratings',
      'Access assigned interview schedules',
      'View candidate profiles for interviews',
      'Collaborate with the hiring team'
    ]
  };

  return permissions[role] || [
    'Access the platform',
    'Collaborate with team members',
    'Participate in the hiring process'
  ];
}

/**
 * Generates email subject line for team invitation
 * @param {Object} invitationData - Invitation data
 * @returns {string} Email subject line
 */
export function generateInvitationEmailSubject(invitationData) {
  const { inviterName, organizationName, role } = invitationData;
  
  return `Invitation to join ${organizationName} as ${role} - Nexus ATS`;
}

/**
 * Validates invitation email data
 * @param {Object} invitationData - Invitation data
 * @throws {Error} If required data is missing
 */
export function validateInvitationEmailData(invitationData) {
  const required = ['inviterName', 'organizationName', 'role', 'acceptanceUrl', 'expiresAt'];
  
  for (const field of required) {
    if (!invitationData[field]) {
      throw new Error(`Missing required field for email template: ${field}`);
    }
  }
  
  // Validate URL format
  try {
    new URL(invitationData.acceptanceUrl);
  } catch (error) {
    throw new Error('Invalid acceptance URL format');
  }
  
  // Validate expiry date
  const expiryDate = new Date(invitationData.expiresAt);
  if (isNaN(expiryDate.getTime())) {
    throw new Error('Invalid expiry date format');
  }
  
  if (expiryDate <= new Date()) {
    throw new Error('Expiry date must be in the future');
  }
}