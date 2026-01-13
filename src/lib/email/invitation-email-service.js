/**
 * Team Invitation Email Service
 * Handles sending team member invitation emails
 */

import { sendEmail, EmailError } from './email-service.js';
import {
  generateInvitationEmailHTML,
  generateInvitationEmailText,
  generateInvitationEmailSubject,
  validateInvitationEmailData
} from './invitation-templates.js';
import { getEnvConfig } from '../env.js';

/**
 * Invitation email service errors
 */
export class InvitationEmailError extends EmailError {
  constructor(message, code = 'INVITATION_EMAIL_ERROR') {
    super(message, code);
    this.name = 'InvitationEmailError';
  }
}

/**
 * Sends team invitation email
 * @param {Object} invitationData - Invitation data
 * @returns {Promise<Object>} Send result
 */
export async function sendInvitationEmail(invitationData) {
  try {
    // Validate invitation data
    validateInvitationEmailData(invitationData);
    
    // Generate email content
    const subject = generateInvitationEmailSubject(invitationData);
    const html = generateInvitationEmailHTML(invitationData);
    const text = generateInvitationEmailText(invitationData);
    
    // Send email
    const result = await sendEmail({
      to: invitationData.email,
      subject,
      html,
      text
    });
    
    console.log('📧 Team invitation email sent successfully:', {
      to: invitationData.email,
      organization: invitationData.organizationName,
      role: invitationData.role,
      messageId: result.messageId
    });
    
    return {
      success: true,
      messageId: result.messageId,
      previewUrl: result.previewUrl,
      recipient: invitationData.email,
      subject
    };
    
  } catch (error) {
    console.error('❌ Failed to send invitation email:', error);
    
    if (error instanceof EmailError) {
      throw error;
    }
    
    throw new InvitationEmailError(
      'Failed to send invitation email. Please try again later.',
      'INVITATION_SEND_FAILED'
    );
  }
}

/**
 * Builds invitation acceptance URL
 * @param {string} token - Invitation token
 * @returns {string} Acceptance URL
 */
export function buildInvitationAcceptanceUrl(token) {
  const config = getEnvConfig();
  const baseUrl = config.NEXTAUTH_URL || 'http://localhost:3000';
  
  return `${baseUrl}/invitations/accept/${token}`;
}

/**
 * Prepares invitation email data from invitation document
 * @param {Object} invitation - Invitation document
 * @returns {Object} Email data ready for sending
 */
export function prepareInvitationEmailData(invitation) {
  if (!invitation) {
    throw new InvitationEmailError('Invitation document is required', 'MISSING_INVITATION');
  }
  
  const acceptanceUrl = buildInvitationAcceptanceUrl(invitation.token);
  
  return {
    email: invitation.email,
    inviterName: invitation.metadata?.inviterName || 'Team Administrator',
    inviterEmail: invitation.metadata?.inviterEmail,
    organizationName: invitation.metadata?.organizationName || 'Nexus ATS',
    role: invitation.role,
    message: invitation.message,
    acceptanceUrl,
    expiresAt: invitation.expiresAt,
    token: invitation.token
  };
}

/**
 * Sends invitation email with automatic data preparation
 * @param {Object} invitation - Invitation document from database
 * @returns {Promise<Object>} Send result
 */
export async function sendInvitationEmailFromDocument(invitation) {
  try {
    const emailData = prepareInvitationEmailData(invitation);
    return await sendInvitationEmail(emailData);
  } catch (error) {
    console.error('❌ Failed to send invitation email from document:', error);
    throw error;
  }
}

/**
 * Validates that invitation email can be sent
 * @param {Object} invitation - Invitation document
 * @throws {InvitationEmailError} If invitation cannot be sent
 */
export function validateInvitationForEmail(invitation) {
  if (!invitation) {
    throw new InvitationEmailError('Invitation document is required', 'MISSING_INVITATION');
  }
  
  if (!invitation.email) {
    throw new InvitationEmailError('Invitation email address is required', 'MISSING_EMAIL');
  }
  
  if (!invitation.token) {
    throw new InvitationEmailError('Invitation token is required', 'MISSING_TOKEN');
  }
  
  if (invitation.status !== 'pending') {
    throw new InvitationEmailError(
      `Cannot send email for invitation with status: ${invitation.status}`,
      'INVALID_STATUS'
    );
  }
  
  // Check if invitation has expired
  if (invitation.expiresAt && new Date(invitation.expiresAt) <= new Date()) {
    throw new InvitationEmailError(
      'Cannot send email for expired invitation',
      'INVITATION_EXPIRED'
    );
  }
}

/**
 * Sends invitation email with validation
 * @param {Object} invitation - Invitation document
 * @returns {Promise<Object>} Send result
 */
export async function sendValidatedInvitationEmail(invitation) {
  try {
    // Validate invitation can be sent
    validateInvitationForEmail(invitation);
    
    // Send email
    return await sendInvitationEmailFromDocument(invitation);
    
  } catch (error) {
    console.error('❌ Invitation email validation failed:', error);
    throw error;
  }
}

/**
 * Formats invitation email error for API response
 * @param {Error} error - Error to format
 * @returns {Object} Formatted error response
 */
export function formatInvitationEmailError(error) {
  if (error instanceof InvitationEmailError) {
    return {
      success: false,
      error: {
        message: error.message,
        code: error.code,
        type: 'invitation_email_error'
      }
    };
  }
  
  if (error instanceof EmailError) {
    return {
      success: false,
      error: {
        message: error.message,
        code: error.code,
        type: 'email_error'
      }
    };
  }
  
  return {
    success: false,
    error: {
      message: 'Failed to send invitation email. Please try again.',
      code: 'UNKNOWN_ERROR',
      type: 'unknown_error'
    }
  };
}

/**
 * Batch sends invitation emails
 * @param {Array<Object>} invitations - Array of invitation documents
 * @returns {Promise<Object>} Batch send results
 */
export async function sendBatchInvitationEmails(invitations) {
  const results = {
    success: [],
    failed: [],
    total: invitations.length
  };
  
  for (const invitation of invitations) {
    try {
      const result = await sendValidatedInvitationEmail(invitation);
      results.success.push({
        email: invitation.email,
        messageId: result.messageId,
        result
      });
    } catch (error) {
      results.failed.push({
        email: invitation.email,
        error: formatInvitationEmailError(error)
      });
    }
  }
  
  console.log(`📧 Batch invitation emails completed: ${results.success.length} sent, ${results.failed.length} failed`);
  
  return results;
}