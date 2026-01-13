/**
 * Team Invitation Data Models and Schema Definitions
 * Defines the structure and validation for team invitation records
 */

import { ObjectId } from 'mongodb';
import crypto from 'crypto';

/**
 * Team member roles enum
 */
export const TEAM_ROLES = {
  ADMIN: 'Admin',
  RECRUITER: 'Recruiter',
  INTERVIEWER: 'Interviewer'
};

/**
 * Invitation status enum
 */
export const INVITATION_STATUS = {
  PENDING: 'pending',
  ACCEPTED: 'accepted',
  DECLINED: 'declined',
  EXPIRED: 'expired'
};

/**
 * Team member status enum
 */
export const MEMBER_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive'
};

/**
 * Role permissions matrix
 */
export const ROLE_PERMISSIONS = {
  [TEAM_ROLES.ADMIN]: {
    canInviteMembers: true,
    canManageJobs: true,
    canManageCandidates: true,
    canScheduleInterviews: true,
    canManageTeam: true,
    canViewAnalytics: true
  },
  [TEAM_ROLES.RECRUITER]: {
    canInviteMembers: false,
    canManageJobs: true,
    canManageCandidates: true,
    canScheduleInterviews: true,
    canManageTeam: false,
    canViewAnalytics: true
  },
  [TEAM_ROLES.INTERVIEWER]: {
    canInviteMembers: false,
    canManageJobs: false,
    canManageCandidates: false,
    canScheduleInterviews: true,
    canManageTeam: false,
    canViewAnalytics: false
  }
};

/**
 * Default invitation expiration time (7 days in milliseconds)
 */
export const INVITATION_EXPIRY_DAYS = 7;
export const INVITATION_EXPIRY_MS = INVITATION_EXPIRY_DAYS * 24 * 60 * 60 * 1000;

/**
 * Creates a new invitation document structure
 * @param {Object} invitationData - Raw invitation data
 * @returns {Object} Formatted invitation document
 */
export function createInvitationDocument(invitationData) {
  const now = new Date();
  const expiresAt = new Date(now.getTime() + INVITATION_EXPIRY_MS);
  
  return {
    organizationId: invitationData.organizationId && ObjectId.isValid(invitationData.organizationId)
      ? new ObjectId(invitationData.organizationId)
      : null,
    email: invitationData.email?.toLowerCase().trim(),
    role: invitationData.role || TEAM_ROLES.INTERVIEWER,
    status: INVITATION_STATUS.PENDING,
    token: generateSecureToken(),
    invitedBy: invitationData.invitedBy && ObjectId.isValid(invitationData.invitedBy)
      ? new ObjectId(invitationData.invitedBy)
      : null,
    message: invitationData.message?.trim() || null,
    createdAt: now,
    expiresAt: expiresAt,
    acceptedAt: null,
    acceptedBy: null,
    metadata: {
      inviterName: invitationData.inviterName?.trim(),
      inviterEmail: invitationData.inviterEmail?.toLowerCase().trim(),
      organizationName: invitationData.organizationName?.trim(),
      ipAddress: invitationData.ipAddress?.trim(),
      userAgent: invitationData.userAgent?.trim()
    }
  };
}

/**
 * Creates a new team member document structure
 * @param {Object} memberData - Raw team member data
 * @returns {Object} Formatted team member document
 */
export function createTeamMemberDocument(memberData) {
  const now = new Date();
  
  return {
    organizationId: memberData.organizationId && ObjectId.isValid(memberData.organizationId)
      ? new ObjectId(memberData.organizationId)
      : null,
    userId: memberData.userId && ObjectId.isValid(memberData.userId)
      ? new ObjectId(memberData.userId)
      : null,
    role: memberData.role || TEAM_ROLES.INTERVIEWER,
    status: memberData.status || MEMBER_STATUS.ACTIVE,
    joinedAt: now,
    invitedBy: memberData.invitedBy && ObjectId.isValid(memberData.invitedBy)
      ? new ObjectId(memberData.invitedBy)
      : null,
    permissions: ROLE_PERMISSIONS[memberData.role] || ROLE_PERMISSIONS[TEAM_ROLES.INTERVIEWER],
    metadata: {
      createdAt: now,
      updatedAt: now,
      lastActiveAt: now,
      isActive: true
    }
  };
}

/**
 * Generates a cryptographically secure invitation token
 * @returns {string} Secure random token
 */
export function generateSecureToken() {
  // Generate 32 bytes of random data and convert to hex
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Validates team role
 * @param {string} role - Team role to validate
 * @returns {boolean} True if valid
 */
export function validateTeamRole(role) {
  return Object.values(TEAM_ROLES).includes(role);
}

/**
 * Validates invitation status
 * @param {string} status - Invitation status to validate
 * @returns {boolean} True if valid
 */
export function validateInvitationStatus(status) {
  return Object.values(INVITATION_STATUS).includes(status);
}

/**
 * Validates member status
 * @param {string} status - Member status to validate
 * @returns {boolean} True if valid
 */
export function validateMemberStatus(status) {
  return Object.values(MEMBER_STATUS).includes(status);
}

/**
 * Checks if an invitation has expired
 * @param {Object} invitation - Invitation document
 * @param {Date} referenceDate - Date to compare against (defaults to now)
 * @returns {boolean} True if invitation has expired
 */
export function isInvitationExpired(invitation, referenceDate = new Date()) {
  if (!invitation || !invitation.expiresAt) {
    return true;
  }
  
  const expiryDate = new Date(invitation.expiresAt);
  return referenceDate > expiryDate;
}

/**
 * Checks if a user has permission for a specific action
 * @param {string} role - User's role
 * @param {string} permission - Permission to check
 * @returns {boolean} True if user has permission
 */
export function hasPermission(role, permission) {
  const rolePermissions = ROLE_PERMISSIONS[role];
  return rolePermissions ? rolePermissions[permission] === true : false;
}

/**
 * Gets all permissions for a role
 * @param {string} role - Team role
 * @returns {Object} Permissions object
 */
export function getRolePermissions(role) {
  return ROLE_PERMISSIONS[role] || ROLE_PERMISSIONS[TEAM_ROLES.INTERVIEWER];
}

/**
 * Formats invitation for display
 * @param {Object} invitation - Invitation document
 * @returns {Object} Formatted invitation for UI display
 */
export function formatInvitationForDisplay(invitation) {
  if (!invitation) return null;
  
  return {
    id: invitation._id ? invitation._id.toString() : new ObjectId().toString(),
    email: invitation.email,
    role: invitation.role,
    status: invitation.status,
    invitedBy: invitation.invitedBy?.toString(),
    message: invitation.message,
    createdAt: invitation.createdAt,
    expiresAt: invitation.expiresAt,
    acceptedAt: invitation.acceptedAt,
    acceptedBy: invitation.acceptedBy?.toString(),
    isExpired: isInvitationExpired(invitation),
    daysUntilExpiry: Math.ceil((new Date(invitation.expiresAt) - new Date()) / (1000 * 60 * 60 * 24)),
    inviterName: invitation.metadata?.inviterName,
    inviterEmail: invitation.metadata?.inviterEmail,
    organizationName: invitation.metadata?.organizationName
  };
}

/**
 * Formats team member for display
 * @param {Object} member - Team member document
 * @param {Object} userInfo - Additional user information
 * @returns {Object} Formatted team member for UI display
 */
export function formatTeamMemberForDisplay(member, userInfo = {}) {
  if (!member) return null;
  
  return {
    id: member._id.toString(),
    userId: member.userId?.toString(),
    name: userInfo.name || 'Unknown User',
    email: userInfo.email || 'unknown@example.com',
    role: member.role,
    status: member.status,
    joinedAt: member.joinedAt,
    invitedBy: member.invitedBy?.toString(),
    permissions: member.permissions,
    lastActive: member.metadata?.lastActiveAt || member.joinedAt,
    isActive: member.metadata?.isActive !== false
  };
}

/**
 * Gets role display information
 * @param {string} role - Team role
 * @returns {Object} Role display information
 */
export function getRoleDisplayInfo(role) {
  const roleInfo = {
    [TEAM_ROLES.ADMIN]: {
      name: 'Administrator',
      description: 'Full access to all features and team management',
      color: 'red',
      permissions: [
        'Invite and manage team members',
        'Create and manage job postings',
        'Manage candidates and applications',
        'Schedule and conduct interviews',
        'View analytics and reports'
      ]
    },
    [TEAM_ROLES.RECRUITER]: {
      name: 'Recruiter',
      description: 'Manage jobs, candidates, and interviews',
      color: 'blue',
      permissions: [
        'Create and manage job postings',
        'Manage candidates and applications',
        'Schedule and conduct interviews',
        'View analytics and reports'
      ]
    },
    [TEAM_ROLES.INTERVIEWER]: {
      name: 'Interviewer',
      description: 'Conduct interviews and provide feedback',
      color: 'green',
      permissions: [
        'Schedule and conduct interviews',
        'Provide interview feedback'
      ]
    }
  };
  
  return roleInfo[role] || roleInfo[TEAM_ROLES.INTERVIEWER];
}

/**
 * Generates user initials from name
 * @param {string} name - User's full name
 * @returns {string} User initials
 */
export function generateUserInitials(name) {
  if (!name || typeof name !== 'string') return 'U';
  
  const parts = name.trim().split(' ').filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
  return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
}

/**
 * MongoDB indexes for optimal query performance
 */
export const INVITATION_INDEXES = [
  // Unique index for email per organization to prevent duplicates
  {
    key: { organizationId: 1, email: 1 },
    options: { unique: true }
  },
  // Index for token-based lookups
  {
    key: { token: 1 },
    options: { unique: true }
  },
  // Index for status-based queries
  {
    key: { status: 1 }
  },
  // Index for expiration cleanup
  {
    key: { expiresAt: 1 }
  },
  // Index for organization-based queries
  {
    key: { organizationId: 1, status: 1 }
  },
  // Index for inviter-based queries
  {
    key: { invitedBy: 1 }
  },
  // Index for creation date sorting
  {
    key: { createdAt: -1 }
  }
];

/**
 * MongoDB indexes for team members collection
 */
export const TEAM_MEMBER_INDEXES = [
  // Unique index for user per organization
  {
    key: { organizationId: 1, userId: 1 },
    options: { unique: true }
  },
  // Index for organization-based queries
  {
    key: { organizationId: 1, status: 1 }
  },
  // Index for role-based queries
  {
    key: { role: 1 }
  },
  // Index for status-based queries
  {
    key: { status: 1 }
  },
  // Index for join date sorting
  {
    key: { joinedAt: -1 }
  },
  // Index for active members
  {
    key: { 'metadata.isActive': 1 }
  },
  // Index for last activity tracking
  {
    key: { 'metadata.lastActiveAt': -1 }
  }
];