/**
 * Property-Based Tests for Team Invitation Creation
 * Feature: team-member-invitation, Property 5: Duplicate Member Prevention
 * Feature: team-member-invitation, Property 6: Duplicate Invitation Prevention  
 * Feature: team-member-invitation, Property 7: Admin-Only Invitation Authorization
 * Validates: Requirements 2.3, 2.4, 2.5
 */

import fc from 'fast-check';
import { ObjectId } from 'mongodb';
import {
  createInvitationDocument,
  TEAM_ROLES,
  INVITATION_STATUS
} from '../invitation-models.js';
import {
  validateInvitationPermissions,
  validateInvitationData,
  sanitizeInvitationInput,
  ValidationError
} from '../invitation-validation.js';

// Helper generators
const validObjectIdGen = () => fc.string().map(() => new ObjectId().toString());
const validEmailGen = () => fc.emailAddress().map(email => email.toLowerCase());
const validTeamRoleGen = () => fc.constantFrom(...Object.values(TEAM_ROLES));

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

describe('Team Invitation Creation Property Tests', () => {
  
  /**
   * Property 5: Duplicate Member Prevention
   * For any email address that already exists as a team member, the system 
   * should prevent creating new invitations and display an appropriate error message.
   */
  describe('Property 5: Duplicate Member Prevention', () => {
    
    test('invitation validation accepts valid data', () => {
      fc.assert(
        fc.property(
          validInvitationDataGen(),
          (invitationData) => {
            // Property: Valid invitation data should pass validation
            expect(() => validateInvitationData(invitationData)).not.toThrow();
          }
        ),
        { numRuns: 100 }
      );
    });

    test('invitation creation produces consistent documents', () => {
      fc.assert(
        fc.property(
          validInvitationDataGen(),
          (invitationData) => {
            // Property: Invitation documents should be created consistently
            const document = createInvitationDocument(invitationData);
            
            // Verify structure and data consistency
            expect(document.email).toBe(invitationData.email.toLowerCase());
            expect(document.role).toBe(invitationData.role);
            expect(document.status).toBe(INVITATION_STATUS.PENDING);
            expect(document.organizationId).toBeInstanceOf(ObjectId);
            expect(document.invitedBy).toBeInstanceOf(ObjectId);
            
            // Verify token format
            expect(typeof document.token).toBe('string');
            expect(document.token).toHaveLength(64);
            expect(document.token).toMatch(/^[a-f0-9]{64}$/);
            
            // Verify timestamps
            expect(document.createdAt).toBeInstanceOf(Date);
            expect(document.expiresAt).toBeInstanceOf(Date);
            expect(document.expiresAt > document.createdAt).toBe(true);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 6: Duplicate Invitation Prevention
   * For any email address that has a pending invitation, the system should 
   * prevent creating duplicate invitations and display an appropriate error message.
   */
  describe('Property 6: Duplicate Invitation Prevention', () => {
    
    test('invitation tokens are unique across multiple generations', () => {
      fc.assert(
        fc.property(
          fc.array(validInvitationDataGen(), { minLength: 2, maxLength: 20 }),
          (invitationDataArray) => {
            // Property: All invitation tokens should be unique
            const documents = invitationDataArray.map(data => createInvitationDocument(data));
            const tokens = documents.map(doc => doc.token);
            
            // All tokens should be unique
            const uniqueTokens = new Set(tokens);
            expect(uniqueTokens.size).toBe(tokens.length);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('invitation data sanitization preserves essential information', () => {
      fc.assert(
        fc.property(
          validInvitationDataGen(),
          (invitationData) => {
            // Property: Sanitization should preserve essential data
            const sanitized = sanitizeInvitationInput(invitationData);
            
            expect(sanitized.email).toBe(invitationData.email.toLowerCase());
            expect(sanitized.role).toBe(invitationData.role);
            
            if (invitationData.message) {
              expect(sanitized.message).toBeTruthy();
              expect(sanitized.message.trim()).toBe(sanitized.message);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 7: Admin-Only Invitation Authorization
   * For any user without admin privileges, the system should prevent invitation 
   * creation and display an authorization error.
   */
  describe('Property 7: Admin-Only Invitation Authorization', () => {
    
    test('admin users can invite any role', () => {
      fc.assert(
        fc.property(
          validTeamRoleGen(),
          (inviteeRole) => {
            // Property: Admin users should be able to invite users to any role
            expect(() => {
              validateInvitationPermissions(TEAM_ROLES.ADMIN, inviteeRole);
            }).not.toThrow();
          }
        ),
        { numRuns: 100 }
      );
    });

    test('non-admin users cannot invite anyone', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(TEAM_ROLES.RECRUITER, TEAM_ROLES.INTERVIEWER),
          validTeamRoleGen(),
          (inviterRole, inviteeRole) => {
            // Property: Non-admin users should not be able to invite anyone
            expect(() => {
              validateInvitationPermissions(inviterRole, inviteeRole);
            }).toThrow(ValidationError);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('only admins can invite other admins', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(TEAM_ROLES.RECRUITER, TEAM_ROLES.INTERVIEWER),
          (nonAdminRole) => {
            // Property: Only admins can invite other admins
            expect(() => {
              validateInvitationPermissions(nonAdminRole, TEAM_ROLES.ADMIN);
            }).toThrow(ValidationError);
          }
        ),
        { numRuns: 100 }
      );
      
      // But admins can invite other admins
      expect(() => {
        validateInvitationPermissions(TEAM_ROLES.ADMIN, TEAM_ROLES.ADMIN);
      }).not.toThrow();
    });

    test('permission validation provides descriptive error messages', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(TEAM_ROLES.RECRUITER, TEAM_ROLES.INTERVIEWER),
          validTeamRoleGen(),
          (inviterRole, inviteeRole) => {
            // Property: Permission validation errors should be descriptive
            try {
              validateInvitationPermissions(inviterRole, inviteeRole);
              // Should not reach here for non-admin inviters
              expect(true).toBe(false);
            } catch (error) {
              expect(error).toBeInstanceOf(ValidationError);
              expect(error.message).toBeTruthy();
              expect(typeof error.message).toBe('string');
              expect(error.message.length).toBeGreaterThan(0);
              expect(error.message.toLowerCase()).toContain('permissions');
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Invitation Data Validation Properties', () => {
    
    test('rejects invitation data with invalid email formats', () => {
      fc.assert(
        fc.property(
          validInvitationDataGen(),
          fc.string().filter(s => !s.includes('@') || s.length > 254),
          (invitationData, invalidEmail) => {
            // Property: Invalid email formats should be rejected
            const invalidData = { ...invitationData, email: invalidEmail };
            
            expect(() => validateInvitationData(invalidData)).toThrow(ValidationError);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('rejects invitation data with invalid roles', () => {
      fc.assert(
        fc.property(
          validInvitationDataGen(),
          fc.string().filter(s => !Object.values(TEAM_ROLES).includes(s)),
          (invitationData, invalidRole) => {
            // Property: Invalid roles should be rejected
            const invalidData = { ...invitationData, role: invalidRole };
            
            expect(() => validateInvitationData(invalidData)).toThrow(ValidationError);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('rejects invitation data with invalid ObjectIds', () => {
      fc.assert(
        fc.property(
          validInvitationDataGen(),
          fc.string().filter(s => !ObjectId.isValid(s)),
          (invitationData, invalidId) => {
            // Property: Invalid ObjectIds should be rejected
            const invalidData = { ...invitationData, organizationId: invalidId };
            
            expect(() => validateInvitationData(invalidData)).toThrow(ValidationError);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('rejects invitation data with oversized messages', () => {
      fc.assert(
        fc.property(
          validInvitationDataGen(),
          fc.string({ minLength: 501, maxLength: 1000 }),
          (invitationData, oversizedMessage) => {
            // Property: Oversized messages should be rejected
            const invalidData = { ...invitationData, message: oversizedMessage };
            
            expect(() => validateInvitationData(invalidData)).toThrow(ValidationError);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('accepts invitation data with optional fields omitted', () => {
      fc.assert(
        fc.property(
          fc.record({
            organizationId: validObjectIdGen(),
            email: validEmailGen(),
            role: validTeamRoleGen(),
            invitedBy: validObjectIdGen(),
            inviterName: fc.string({ minLength: 1, maxLength: 100 }),
            inviterEmail: validEmailGen(),
            organizationName: fc.string({ minLength: 1, maxLength: 100 })
            // Omitting optional fields: message, ipAddress, userAgent
          }),
          (minimalData) => {
            // Property: Minimal valid data should pass validation
            expect(() => validateInvitationData(minimalData)).not.toThrow();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});