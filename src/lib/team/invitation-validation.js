/**
 * Team Invitation Data Validation
 * Provides validation functions for team invitation data integrity
 */

import { ObjectId } from 'mongodb';
import { 
  TEAM_ROLES, 
  INVITATION_STATUS, 
  MEMBER_STATUS,
  validateTeamRole,
  validateInvitationStatus,
  validateMemberStatus
} from './invitation-models.js';

/**
 * Email validation regex (RFC 5322 compliant)
 */
const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

/**
 * Validation error class
 */
export class ValidationError extends Error {
  constructor(message, field = null) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
  }
}

/**
 * Validates invitation basic information
 * @param {Object} invitationData - Invitation data object
 * @throws {ValidationError} If validation fails
 */
export function validateInvitationBasicInfo(invitationData) {
  const errors = [];

  // Email validation
  if (!invitationData.email) {
    errors.push({ field: 'email', message: 'Email address is required' });
  } else if (typeof invitationData.email !== 'string') {
    errors.push({ field: 'email', message: 'Email address must be a string' });
  } else {
    const email = invitationData.email.trim().toLowerCase();
    if (!EMAIL_REGEX.test(email)) {
      errors.push({ field: 'email', message: 'Please enter a valid email address' });
    } else if (email.length > 254) {
      errors.push({ field: 'email', message: 'Email address cannot exceed 254 characters' });
    }
  }

  // Role validation
  if (!invitationData.role) {
    errors.push({ field: 'role', message: 'Please select a role for the team member' });
  } else if (!validateTeamRole(invitationData.role)) {
    errors.push({ 
      field: 'role', 
      message: `Role must be one of: ${Object.values(TEAM_ROLES).join(', ')}` 
    });
  }

  // Organization ID validation
  if (!invitationData.organizationId) {
    errors.push({ field: 'organizationId', message: 'Organization ID is required' });
  } else if (!ObjectId.isValid(invitationData.organizationId)) {
    errors.push({ field: 'organizationId', message: 'Organization ID must be a valid ObjectId' });
  }

  // Inviter ID validation
  if (!invitationData.invitedBy) {
    errors.push({ field: 'invitedBy', message: 'Inviter ID is required' });
  } else if (!ObjectId.isValid(invitationData.invitedBy)) {
    errors.push({ field: 'invitedBy', message: 'Inviter ID must be a valid ObjectId' });
  }

  if (errors.length > 0) {
    throw new ValidationError('Invitation basic information validation failed', errors);
  }
}

/**
 * Validates invitation message
 * @param {string} message - Optional personal message
 * @throws {ValidationError} If validation fails
 */
export function validateInvitationMessage(message) {
  const errors = [];

  if (message !== undefined && message !== null) {
    if (typeof message !== 'string') {
      errors.push({ field: 'message', message: 'Personal message must be a string' });
    } else if (message.length > 500) {
      errors.push({ field: 'message', message: 'Personal message cannot exceed 500 characters' });
    }
  }

  if (errors.length > 0) {
    throw new ValidationError('Invitation message validation failed', errors);
  }
}

/**
 * Validates invitation metadata
 * @param {Object} metadata - Invitation metadata
 * @throws {ValidationError} If validation fails
 */
export function validateInvitationMetadata(metadata) {
  const errors = [];

  if (metadata && typeof metadata === 'object') {
    // Inviter name validation
    if (metadata.inviterName) {
      if (typeof metadata.inviterName !== 'string') {
        errors.push({ field: 'inviterName', message: 'Inviter name must be a string' });
      } else if (metadata.inviterName.trim().length > 100) {
        errors.push({ field: 'inviterName', message: 'Inviter name cannot exceed 100 characters' });
      }
    }

    // Inviter email validation
    if (metadata.inviterEmail) {
      if (typeof metadata.inviterEmail !== 'string') {
        errors.push({ field: 'inviterEmail', message: 'Inviter email must be a string' });
      } else {
        const email = metadata.inviterEmail.trim().toLowerCase();
        if (!EMAIL_REGEX.test(email)) {
          errors.push({ field: 'inviterEmail', message: 'Inviter email must be a valid email address' });
        }
      }
    }

    // Organization name validation
    if (metadata.organizationName) {
      if (typeof metadata.organizationName !== 'string') {
        errors.push({ field: 'organizationName', message: 'Organization name must be a string' });
      } else if (metadata.organizationName.trim().length > 100) {
        errors.push({ field: 'organizationName', message: 'Organization name cannot exceed 100 characters' });
      }
    }

    // IP address validation (basic format check)
    if (metadata.ipAddress) {
      if (typeof metadata.ipAddress !== 'string') {
        errors.push({ field: 'ipAddress', message: 'IP address must be a string' });
      } else if (metadata.ipAddress.length > 45) { // IPv6 max length
        errors.push({ field: 'ipAddress', message: 'IP address format is invalid' });
      }
    }

    // User agent validation
    if (metadata.userAgent) {
      if (typeof metadata.userAgent !== 'string') {
        errors.push({ field: 'userAgent', message: 'User agent must be a string' });
      } else if (metadata.userAgent.length > 500) {
        errors.push({ field: 'userAgent', message: 'User agent string is too long' });
      }
    }
  }

  if (errors.length > 0) {
    throw new ValidationError('Invitation metadata validation failed', errors);
  }
}

/**
 * Validates team member basic information
 * @param {Object} memberData - Team member data object
 * @throws {ValidationError} If validation fails
 */
export function validateTeamMemberBasicInfo(memberData) {
  const errors = [];

  // Organization ID validation
  if (!memberData.organizationId) {
    errors.push({ field: 'organizationId', message: 'Organization ID is required' });
  } else if (!ObjectId.isValid(memberData.organizationId)) {
    errors.push({ field: 'organizationId', message: 'Organization ID must be a valid ObjectId' });
  }

  // User ID validation
  if (!memberData.userId) {
    errors.push({ field: 'userId', message: 'User ID is required' });
  } else if (!ObjectId.isValid(memberData.userId)) {
    errors.push({ field: 'userId', message: 'User ID must be a valid ObjectId' });
  }

  // Role validation
  if (!memberData.role) {
    errors.push({ field: 'role', message: 'Role is required' });
  } else if (!validateTeamRole(memberData.role)) {
    errors.push({ 
      field: 'role', 
      message: `Role must be one of: ${Object.values(TEAM_ROLES).join(', ')}` 
    });
  }

  // Status validation
  if (memberData.status && !validateMemberStatus(memberData.status)) {
    errors.push({ 
      field: 'status', 
      message: `Status must be one of: ${Object.values(MEMBER_STATUS).join(', ')}` 
    });
  }

  if (errors.length > 0) {
    throw new ValidationError('Team member basic information validation failed', errors);
  }
}

/**
 * Validates invitation token
 * @param {string} token - Invitation token
 * @throws {ValidationError} If validation fails
 */
export function validateInvitationToken(token) {
  const errors = [];

  if (!token) {
    errors.push({ field: 'token', message: 'Invitation token is required' });
  } else if (typeof token !== 'string') {
    errors.push({ field: 'token', message: 'Invitation token must be a string' });
  } else if (token.length !== 64) { // 32 bytes in hex = 64 characters
    errors.push({ field: 'token', message: 'Invalid invitation token format' });
  } else if (!/^[a-f0-9]{64}$/i.test(token)) {
    errors.push({ field: 'token', message: 'Invalid invitation token format' });
  }

  if (errors.length > 0) {
    throw new ValidationError('Invitation token validation failed', errors);
  }
}

/**
 * Validates admin-only invitation permissions
 * @param {string} inviterRole - Role of the user sending invitation
 * @param {string} inviteeRole - Role being assigned to invitee
 * @throws {ValidationError} If validation fails
 */
export function validateInvitationPermissions(inviterRole, inviteeRole) {
  const errors = [];

  // Only admins can send invitations
  if (inviterRole !== TEAM_ROLES.ADMIN) {
    errors.push({ field: 'permissions', message: 'Only administrators can invite team members' });
  }

  // Only admins can invite other admins
  if (inviteeRole === TEAM_ROLES.ADMIN && inviterRole !== TEAM_ROLES.ADMIN) {
    errors.push({ field: 'permissions', message: 'Only administrators can invite other administrators' });
  }

  if (errors.length > 0) {
    throw new ValidationError('Invitation permissions validation failed', errors);
  }
}

/**
 * Validates complete invitation data
 * @param {Object} invitationData - Complete invitation data
 * @throws {ValidationError} If validation fails
 */
export function validateInvitationData(invitationData) {
  if (!invitationData || typeof invitationData !== 'object') {
    throw new ValidationError('Invitation data is required and must be an object');
  }

  // Validate basic information
  validateInvitationBasicInfo(invitationData);

  // Validate optional message
  validateInvitationMessage(invitationData.message);

  // Validate metadata
  validateInvitationMetadata(invitationData.metadata);
}

/**
 * Validates complete team member data
 * @param {Object} memberData - Complete team member data
 * @throws {ValidationError} If validation fails
 */
export function validateTeamMemberData(memberData) {
  if (!memberData || typeof memberData !== 'object') {
    throw new ValidationError('Team member data is required and must be an object');
  }

  // Validate basic information
  validateTeamMemberBasicInfo(memberData);
}

/**
 * Validates invitation acceptance data
 * @param {Object} acceptanceData - Invitation acceptance data
 * @throws {ValidationError} If validation fails
 */
export function validateInvitationAcceptanceData(acceptanceData) {
  const errors = [];

  if (!acceptanceData || typeof acceptanceData !== 'object') {
    throw new ValidationError('Acceptance data is required and must be an object');
  }

  // Token validation
  validateInvitationToken(acceptanceData.token);

  // User data validation (for new user creation)
  if (acceptanceData.userData) {
    if (typeof acceptanceData.userData !== 'object') {
      errors.push({ field: 'userData', message: 'User data must be an object' });
    } else {
      // Name validation
      if (acceptanceData.userData.name) {
        if (typeof acceptanceData.userData.name !== 'string') {
          errors.push({ field: 'userData.name', message: 'Name must be a string' });
        } else if (acceptanceData.userData.name.trim().length < 1) {
          errors.push({ field: 'userData.name', message: 'Name cannot be empty' });
        } else if (acceptanceData.userData.name.trim().length > 100) {
          errors.push({ field: 'userData.name', message: 'Name cannot exceed 100 characters' });
        }
      }

      // Password validation (for new accounts)
      if (acceptanceData.userData.password) {
        if (typeof acceptanceData.userData.password !== 'string') {
          errors.push({ field: 'userData.password', message: 'Password must be a string' });
        } else if (acceptanceData.userData.password.length < 8) {
          errors.push({ field: 'userData.password', message: 'Password must be at least 8 characters long' });
        } else {
          // Password strength validation
          const hasUpperCase = /[A-Z]/.test(acceptanceData.userData.password);
          const hasLowerCase = /[a-z]/.test(acceptanceData.userData.password);
          const hasNumbers = /\d/.test(acceptanceData.userData.password);
          const hasSpecialChar = /[!@#$%^&*(),.?":{}|<>]/.test(acceptanceData.userData.password);

          if (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChar) {
            errors.push({ 
              field: 'userData.password', 
              message: 'Password must contain uppercase, lowercase, number, and special character' 
            });
          }
        }
      }
    }
  }

  if (errors.length > 0) {
    throw new ValidationError('Invitation acceptance validation failed', errors);
  }
}

/**
 * Sanitizes invitation input data
 * @param {Object} invitationData - Raw invitation data
 * @returns {Object} Sanitized invitation data
 */
export function sanitizeInvitationInput(invitationData) {
  if (!invitationData || typeof invitationData !== 'object') {
    return {};
  }

  const sanitized = { ...invitationData };

  // Sanitize email
  if (sanitized.email) {
    sanitized.email = sanitized.email.trim().toLowerCase();
  }

  // Sanitize message
  if (sanitized.message) {
    sanitized.message = sanitizeString(sanitized.message);
  }

  // Sanitize metadata
  if (sanitized.metadata && typeof sanitized.metadata === 'object') {
    if (sanitized.metadata.inviterName) {
      sanitized.metadata.inviterName = sanitizeString(sanitized.metadata.inviterName);
    }
    if (sanitized.metadata.inviterEmail) {
      sanitized.metadata.inviterEmail = sanitized.metadata.inviterEmail.trim().toLowerCase();
    }
    if (sanitized.metadata.organizationName) {
      sanitized.metadata.organizationName = sanitizeString(sanitized.metadata.organizationName);
    }
    if (sanitized.metadata.ipAddress) {
      sanitized.metadata.ipAddress = sanitized.metadata.ipAddress.trim();
    }
    if (sanitized.metadata.userAgent) {
      sanitized.metadata.userAgent = sanitized.metadata.userAgent.trim();
    }
  }

  return sanitized;
}

/**
 * Sanitizes team member input data
 * @param {Object} memberData - Raw team member data
 * @returns {Object} Sanitized team member data
 */
export function sanitizeTeamMemberInput(memberData) {
  if (!memberData || typeof memberData !== 'object') {
    return {};
  }

  const sanitized = { ...memberData };

  // No string fields to sanitize in basic member data
  // Role and status are validated against enums

  return sanitized;
}

/**
 * Sanitizes string input
 * @param {string} input - Raw string input
 * @returns {string} Sanitized string
 */
export function sanitizeString(input) {
  if (!input || typeof input !== 'string') {
    return '';
  }
  
  return input.trim().replace(/\s+/g, ' ');
}

/**
 * Validates pagination parameters
 * @param {Object} params - Pagination parameters
 * @returns {Object} Validated pagination parameters
 */
export function validatePaginationParams(params = {}) {
  // Handle null or undefined params
  if (!params || typeof params !== 'object') {
    params = {};
  }
  
  const page = Math.max(1, parseInt(params.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(params.limit) || 20));
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

/**
 * Validates invitation filter parameters
 * @param {Object} filters - Filter parameters
 * @returns {Object} Validated filter parameters
 */
export function validateInvitationFilters(filters = {}) {
  // Handle null or undefined filters
  if (!filters || typeof filters !== 'object') {
    return {};
  }
  
  const validatedFilters = {};

  // Status filter
  if (filters.status) {
    if (Object.values(INVITATION_STATUS).includes(filters.status)) {
      validatedFilters.status = filters.status;
    }
  }

  // Role filter
  if (filters.role) {
    if (Object.values(TEAM_ROLES).includes(filters.role)) {
      validatedFilters.role = filters.role;
    }
  }

  // Organization ID filter
  if (filters.organizationId && ObjectId.isValid(filters.organizationId)) {
    validatedFilters.organizationId = new ObjectId(filters.organizationId);
  }

  // Inviter ID filter
  if (filters.invitedBy && ObjectId.isValid(filters.invitedBy)) {
    validatedFilters.invitedBy = new ObjectId(filters.invitedBy);
  }

  return validatedFilters;
}

/**
 * Validates team member filter parameters
 * @param {Object} filters - Filter parameters
 * @returns {Object} Validated filter parameters
 */
export function validateTeamMemberFilters(filters = {}) {
  const validatedFilters = {};

  // Status filter
  if (filters.status) {
    if (Object.values(MEMBER_STATUS).includes(filters.status)) {
      validatedFilters.status = filters.status;
    }
  }

  // Role filter
  if (filters.role) {
    if (Object.values(TEAM_ROLES).includes(filters.role)) {
      validatedFilters.role = filters.role;
    }
  }

  // Organization ID filter
  if (filters.organizationId && ObjectId.isValid(filters.organizationId)) {
    validatedFilters.organizationId = new ObjectId(filters.organizationId);
  }

  return validatedFilters;
}