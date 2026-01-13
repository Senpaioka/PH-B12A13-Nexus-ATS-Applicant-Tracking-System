/**
 * Property-Based Tests for Team Invitation Data Models
 * Feature: team-member-invitation, Property 1: Invitation Creation Consistency
 * Validates: Requirements 1.3, 3.1
 */

import fc from 'fast-check';
import { ObjectId } from 'mongodb';
import {
  createInvitationDocument,
  createTeamMemberDocument,
  generateSecureToken,
  validateTeamRole,
  validateInvitationStatus,
  validateMemberStatus,
  isInvitationExpired,
  hasPermission,
  getRolePermissions,
  formatInvitationForDisplay,
  formatTeamMemberForDisplay,
  generateUserInitials,
  TEAM_ROLES,
  INVITATION_STATUS,
  MEMBER_STATUS,
  ROLE_PERMISSIONS,
  INVITATION_EXPIRY_MS
} from '../invitation-models.js';

// Helper generators for valid data
const validObjectIdGen = () => fc.string().map(() => new ObjectId().toString());

const validEmailGen = () => fc.emailAddress().map(email => email.toLowerCase());

const validTeamRoleGen = () => fc.constantFrom(...Object.values(TEAM_ROLES));

const validInvitationStatusGen = () => fc.constantFrom(...Object.values(INVITATION_STATUS));

const validMemberStatusGen = () => fc.constantFrom(...Object.values(MEMBER_STATUS));

const validInvitationDataGen = () => fc.record({
  organizationId: validObjectIdGen(),
  email: validEmailGen(),
  role: validTeamRoleGen(),
  invitedBy: validObjectIdGen(),
  message: fc.option(fc.string({ minLength: 1, maxLength: 500 })),
  inviterName: fc.string({ minLength: 1, maxLength: 100 }),
  inviterEmail: validEmailGen(),
  organizationName: fc.string({ minLength: 1, maxLength: 100 }),
  ipAddress: fc.option(fc.ipV4()),
  userAgent: fc.option(fc.string({ minLength: 1, maxLength: 500 }))
});

const validTeamMemberDataGen = () => fc.record({
  organizationId: validObjectIdGen(),
  userId: validObjectIdGen(),
  role: validTeamRoleGen(),
  status: fc.option(validMemberStatusGen()),
  invitedBy: fc.option(validObjectIdGen())
});

describe('Team Invitation Models Property Tests', () => {
  
  /**
   * Property 1: Invitation Creation Consistency
   * For any valid email address and role combination, creating an invitation 
   * should result in a pending invitation record being stored in the database 
   * with the correct email and role.
   */
  describe('Property 1: Invitation Creation Consistency', () => {
    
    test('creates invitation documents with consistent structure', () => {
      fc.assert(
        fc.property(
          validInvitationDataGen(),
          (invitationData) => {
            // Property: Valid invitation data should create consistent document structure
            const document = createInvitationDocument(invitationData);
            
            // Verify required fields are present
            expect(document).toHaveProperty('organizationId');
            expect(document).toHaveProperty('email');
            expect(document).toHaveProperty('role');
            expect(document).toHaveProperty('status');
            expect(document).toHaveProperty('token');
            expect(document).toHaveProperty('invitedBy');
            expect(document).toHaveProperty('createdAt');
            expect(document).toHaveProperty('expiresAt');
            expect(document).toHaveProperty('metadata');
            
            // Verify data consistency
            expect(document.email).toBe(invitationData.email.toLowerCase().trim());
            expect(document.role).toBe(invitationData.role);
            expect(document.status).toBe(INVITATION_STATUS.PENDING);
            expect(document.organizationId).toBeInstanceOf(ObjectId);
            expect(document.invitedBy).toBeInstanceOf(ObjectId);
            
            // Verify token is secure
            expect(typeof document.token).toBe('string');
            expect(document.token).toHaveLength(64); // 32 bytes in hex
            expect(document.token).toMatch(/^[a-f0-9]{64}$/);
            
            // Verify timestamps
            expect(document.createdAt).toBeInstanceOf(Date);
            expect(document.expiresAt).toBeInstanceOf(Date);
            expect(document.expiresAt.getTime() - document.createdAt.getTime()).toBe(INVITATION_EXPIRY_MS);
            
            // Verify metadata structure
            expect(document.metadata).toHaveProperty('inviterName');
            expect(document.metadata).toHaveProperty('inviterEmail');
            expect(document.metadata).toHaveProperty('organizationName');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('creates team member documents with consistent structure', () => {
      fc.assert(
        fc.property(
          validTeamMemberDataGen(),
          (memberData) => {
            // Property: Valid member data should create consistent document structure
            const document = createTeamMemberDocument(memberData);
            
            // Verify required fields are present
            expect(document).toHaveProperty('organizationId');
            expect(document).toHaveProperty('userId');
            expect(document).toHaveProperty('role');
            expect(document).toHaveProperty('status');
            expect(document).toHaveProperty('joinedAt');
            expect(document).toHaveProperty('permissions');
            expect(document).toHaveProperty('metadata');
            
            // Verify data consistency
            expect(document.role).toBe(memberData.role);
            expect(document.organizationId).toBeInstanceOf(ObjectId);
            expect(document.userId).toBeInstanceOf(ObjectId);
            expect(document.joinedAt).toBeInstanceOf(Date);
            
            // Verify permissions match role
            const expectedPermissions = ROLE_PERMISSIONS[memberData.role];
            expect(document.permissions).toEqual(expectedPermissions);
            
            // Verify metadata structure
            expect(document.metadata).toHaveProperty('createdAt');
            expect(document.metadata).toHaveProperty('updatedAt');
            expect(document.metadata).toHaveProperty('lastActiveAt');
            expect(document.metadata).toHaveProperty('isActive');
            expect(document.metadata.isActive).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('generates unique secure tokens', () => {
      fc.assert(
        fc.property(
          fc.integer({ min: 2, max: 100 }),
          (count) => {
            // Property: Generated tokens should be unique and secure
            const tokens = Array.from({ length: count }, () => generateSecureToken());
            
            // All tokens should be unique
            const uniqueTokens = new Set(tokens);
            expect(uniqueTokens.size).toBe(tokens.length);
            
            // All tokens should be properly formatted
            tokens.forEach(token => {
              expect(typeof token).toBe('string');
              expect(token).toHaveLength(64);
              expect(token).toMatch(/^[a-f0-9]{64}$/);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    test('validates team roles correctly', () => {
      fc.assert(
        fc.property(
          validTeamRoleGen(),
          (validRole) => {
            // Property: Valid team roles should pass validation
            expect(validateTeamRole(validRole)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
      
      fc.assert(
        fc.property(
          fc.string().filter(s => !Object.values(TEAM_ROLES).includes(s)),
          (invalidRole) => {
            // Property: Invalid team roles should fail validation
            expect(validateTeamRole(invalidRole)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('validates invitation status correctly', () => {
      fc.assert(
        fc.property(
          validInvitationStatusGen(),
          (validStatus) => {
            // Property: Valid invitation statuses should pass validation
            expect(validateInvitationStatus(validStatus)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
      
      fc.assert(
        fc.property(
          fc.string().filter(s => !Object.values(INVITATION_STATUS).includes(s)),
          (invalidStatus) => {
            // Property: Invalid invitation statuses should fail validation
            expect(validateInvitationStatus(invalidStatus)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('validates member status correctly', () => {
      fc.assert(
        fc.property(
          validMemberStatusGen(),
          (validStatus) => {
            // Property: Valid member statuses should pass validation
            expect(validateMemberStatus(validStatus)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
      
      fc.assert(
        fc.property(
          fc.string().filter(s => !Object.values(MEMBER_STATUS).includes(s)),
          (invalidStatus) => {
            // Property: Invalid member statuses should fail validation
            expect(validateMemberStatus(invalidStatus)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Invitation Expiration Properties', () => {
    
    test('correctly identifies expired invitations', () => {
      fc.assert(
        fc.property(
          validInvitationDataGen(),
          fc.integer({ min: 1, max: 30 }), // Days in the past
          (invitationData, daysAgo) => {
            // Property: Invitations past their expiry date should be identified as expired
            const document = createInvitationDocument(invitationData);
            
            // Set expiry date in the past
            const pastDate = new Date();
            pastDate.setDate(pastDate.getDate() - daysAgo);
            document.expiresAt = pastDate;
            
            expect(isInvitationExpired(document)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('correctly identifies non-expired invitations', () => {
      fc.assert(
        fc.property(
          validInvitationDataGen(),
          fc.integer({ min: 1, max: 30 }), // Days in the future
          (invitationData, daysFromNow) => {
            // Property: Invitations before their expiry date should not be expired
            const document = createInvitationDocument(invitationData);
            
            // Set expiry date in the future
            const futureDate = new Date();
            futureDate.setDate(futureDate.getDate() + daysFromNow);
            document.expiresAt = futureDate;
            
            expect(isInvitationExpired(document)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Permission System Properties', () => {
    
    test('role permissions are consistent with definitions', () => {
      fc.assert(
        fc.property(
          validTeamRoleGen(),
          (role) => {
            // Property: Role permissions should match the defined permission matrix
            const permissions = getRolePermissions(role);
            const expectedPermissions = ROLE_PERMISSIONS[role];
            
            expect(permissions).toEqual(expectedPermissions);
            
            // Verify permission structure
            expect(permissions).toHaveProperty('canInviteMembers');
            expect(permissions).toHaveProperty('canManageJobs');
            expect(permissions).toHaveProperty('canManageCandidates');
            expect(permissions).toHaveProperty('canScheduleInterviews');
            expect(permissions).toHaveProperty('canManageTeam');
            expect(permissions).toHaveProperty('canViewAnalytics');
            
            // All permission values should be boolean
            Object.values(permissions).forEach(permission => {
              expect(typeof permission).toBe('boolean');
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    test('permission checking works correctly', () => {
      fc.assert(
        fc.property(
          validTeamRoleGen(),
          fc.constantFrom('canInviteMembers', 'canManageJobs', 'canManageCandidates', 
                         'canScheduleInterviews', 'canManageTeam', 'canViewAnalytics'),
          (role, permission) => {
            // Property: Permission checking should match role definitions
            const hasPermissionResult = hasPermission(role, permission);
            const expectedResult = ROLE_PERMISSIONS[role][permission];
            
            expect(hasPermissionResult).toBe(expectedResult);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('admin role has all permissions', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('canInviteMembers', 'canManageJobs', 'canManageCandidates', 
                         'canScheduleInterviews', 'canManageTeam', 'canViewAnalytics'),
          (permission) => {
            // Property: Admin role should have all permissions
            expect(hasPermission(TEAM_ROLES.ADMIN, permission)).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('interviewer role has minimal permissions', () => {
      fc.assert(
        fc.property(
          fc.constantFrom('canInviteMembers', 'canManageJobs', 'canManageCandidates', 
                         'canManageTeam', 'canViewAnalytics'),
          (permission) => {
            // Property: Interviewer role should not have management permissions
            expect(hasPermission(TEAM_ROLES.INTERVIEWER, permission)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
      
      // But should have interview permission
      expect(hasPermission(TEAM_ROLES.INTERVIEWER, 'canScheduleInterviews')).toBe(true);
    });
  });

  describe('Display Formatting Properties', () => {
    
    test('invitation display formatting preserves data integrity', () => {
      fc.assert(
        fc.property(
          validInvitationDataGen(),
          (invitationData) => {
            // Property: Display formatting should preserve essential data
            const document = createInvitationDocument(invitationData);
            document._id = new ObjectId();
            
            const formatted = formatInvitationForDisplay(document);
            
            expect(formatted).toHaveProperty('id');
            expect(formatted).toHaveProperty('email');
            expect(formatted).toHaveProperty('role');
            expect(formatted).toHaveProperty('status');
            expect(formatted).toHaveProperty('isExpired');
            expect(formatted).toHaveProperty('metadata');
            
            // Verify data consistency
            expect(formatted.id).toBe(document._id.toString());
            expect(formatted.email).toBe(document.email);
            expect(formatted.role).toBe(document.role);
            expect(formatted.status).toBe(document.status);
            expect(typeof formatted.isExpired).toBe('boolean');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('team member display formatting preserves data integrity', () => {
      fc.assert(
        fc.property(
          validTeamMemberDataGen(),
          fc.record({
            name: fc.string({ minLength: 1, maxLength: 100 }),
            email: validEmailGen()
          }),
          (memberData, userInfo) => {
            // Property: Display formatting should preserve essential data
            const document = createTeamMemberDocument(memberData);
            document._id = new ObjectId();
            
            const formatted = formatTeamMemberForDisplay(document, userInfo);
            
            expect(formatted).toHaveProperty('id');
            expect(formatted).toHaveProperty('userId');
            expect(formatted).toHaveProperty('name');
            expect(formatted).toHaveProperty('email');
            expect(formatted).toHaveProperty('role');
            expect(formatted).toHaveProperty('status');
            expect(formatted).toHaveProperty('permissions');
            
            // Verify data consistency
            expect(formatted.id).toBe(document._id.toString());
            expect(formatted.userId).toBe(document.userId.toString());
            expect(formatted.name).toBe(userInfo.name);
            expect(formatted.email).toBe(userInfo.email);
            expect(formatted.role).toBe(document.role);
            expect(formatted.status).toBe(document.status);
            expect(formatted.permissions).toEqual(document.permissions);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('user initials generation works correctly', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          (name) => {
            // Property: User initials should be generated consistently
            const initials = generateUserInitials(name);
            
            expect(typeof initials).toBe('string');
            expect(initials.length).toBeGreaterThan(0);
            expect(initials.length).toBeLessThanOrEqual(2);
            
            // Should be uppercase (but may contain non-letter characters)
            expect(initials).toBe(initials.toUpperCase());
            
            // Should match the expected pattern based on name structure
            const parts = name.trim().split(' ').filter(Boolean);
            if (parts.length === 0) {
              expect(initials).toBe('U');
            } else if (parts.length === 1) {
              expect(initials).toBe(parts[0].charAt(0).toUpperCase());
            } else {
              const expected = (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
              expect(initials).toBe(expected);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('user initials handle edge cases gracefully', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant(''),
            fc.constant('   '),
            fc.constant(null),
            fc.constant(undefined),
            fc.integer()
          ),
          (invalidName) => {
            // Property: Invalid names should return default initial
            const initials = generateUserInitials(invalidName);
            expect(initials).toBe('U');
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Data Consistency Properties', () => {
    
    test('invitation documents maintain referential integrity', () => {
      fc.assert(
        fc.property(
          validInvitationDataGen(),
          (invitationData) => {
            // Property: Invitation documents should maintain proper ObjectId references
            const document = createInvitationDocument(invitationData);
            
            // Verify ObjectId fields are properly converted
            if (document.organizationId) {
              expect(document.organizationId).toBeInstanceOf(ObjectId);
              expect(ObjectId.isValid(document.organizationId)).toBe(true);
            }
            
            if (document.invitedBy) {
              expect(document.invitedBy).toBeInstanceOf(ObjectId);
              expect(ObjectId.isValid(document.invitedBy)).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('team member documents maintain referential integrity', () => {
      fc.assert(
        fc.property(
          validTeamMemberDataGen(),
          (memberData) => {
            // Property: Team member documents should maintain proper ObjectId references
            const document = createTeamMemberDocument(memberData);
            
            // Verify ObjectId fields are properly converted
            if (document.organizationId) {
              expect(document.organizationId).toBeInstanceOf(ObjectId);
              expect(ObjectId.isValid(document.organizationId)).toBe(true);
            }
            
            if (document.userId) {
              expect(document.userId).toBeInstanceOf(ObjectId);
              expect(ObjectId.isValid(document.userId)).toBe(true);
            }
            
            if (document.invitedBy) {
              expect(document.invitedBy).toBeInstanceOf(ObjectId);
              expect(ObjectId.isValid(document.invitedBy)).toBe(true);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('email normalization is consistent', () => {
      fc.assert(
        fc.property(
          fc.emailAddress(),
          fc.constantFrom('', ' ', '\t', '\n', '  \t\n  '),
          (email, whitespace) => {
            // Property: Email normalization should be consistent regardless of input format
            const emailWithWhitespace = whitespace + email.toUpperCase() + whitespace;
            const invitationData = {
              organizationId: new ObjectId().toString(),
              email: emailWithWhitespace,
              role: TEAM_ROLES.INTERVIEWER,
              invitedBy: new ObjectId().toString(),
              inviterName: 'Test User',
              inviterEmail: 'test@example.com',
              organizationName: 'Test Org'
            };
            
            const document = createInvitationDocument(invitationData);
            
            // Email should be normalized to lowercase and trimmed
            expect(document.email).toBe(email.toLowerCase());
            expect(document.email).not.toMatch(/^\s/);
            expect(document.email).not.toMatch(/\s$/);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});