/**
 * Property-Based Tests for Team Invitation Retrieval
 * Feature: team-member-invitation, Property 8: Invitation Status Display
 * Validates: Requirements 3.2
 */

import fc from 'fast-check';
import { ObjectId } from 'mongodb';
import {
  createInvitationDocument,
  TEAM_ROLES,
  INVITATION_STATUS,
  formatInvitationForDisplay
} from '../invitation-models.js';
import {
  validatePaginationParams,
  validateInvitationFilters
} from '../invitation-validation.js';

// Helper generators
const validObjectIdGen = () => fc.string().map(() => new ObjectId().toString());
const validEmailGen = () => fc.emailAddress().map(email => email.toLowerCase());
const validTeamRoleGen = () => fc.constantFrom(...Object.values(TEAM_ROLES));
const validInvitationStatusGen = () => fc.constantFrom(...Object.values(INVITATION_STATUS));

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

describe('Team Invitation Retrieval Property Tests', () => {
  
  /**
   * Property 8: Invitation Status Display
   * For any invitation document, the system should format it consistently 
   * for display with all required fields and proper status representation.
   */
  describe('Property 8: Invitation Status Display', () => {
    
    test('invitation formatting preserves essential information', () => {
      fc.assert(
        fc.property(
          validInvitationDataGen(),
          (invitationData) => {
            // Property: Invitation formatting should preserve essential information
            const document = createInvitationDocument(invitationData);
            const formatted = formatInvitationForDisplay(document);
            
            // Verify essential fields are preserved
            expect(formatted.id).toBeTruthy();
            expect(formatted.email).toBe(document.email);
            expect(formatted.role).toBe(document.role);
            expect(formatted.status).toBe(document.status);
            expect(formatted.inviterName).toBe(document.metadata?.inviterName);
            expect(formatted.organizationName).toBe(document.metadata?.organizationName);
            
            // Verify timestamps are formatted
            expect(formatted.createdAt).toBeInstanceOf(Date);
            expect(formatted.expiresAt).toBeInstanceOf(Date);
            
            // Verify sensitive data is excluded
            expect(formatted.token).toBeUndefined();
            expect(formatted._id).toBeUndefined();
            expect(formatted.ipAddress).toBeUndefined();
            expect(formatted.userAgent).toBeUndefined();
          }
        ),
        { numRuns: 100 }
      );
    });

    test('invitation formatting handles all status types consistently', () => {
      fc.assert(
        fc.property(
          validInvitationDataGen(),
          validInvitationStatusGen(),
          (invitationData, status) => {
            // Property: All invitation statuses should be formatted consistently
            const document = createInvitationDocument(invitationData);
            document.status = status;
            
            const formatted = formatInvitationForDisplay(document);
            
            expect(formatted.status).toBe(status);
            expect(Object.values(INVITATION_STATUS)).toContain(formatted.status);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('invitation formatting handles optional fields gracefully', () => {
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
            // Property: Formatting should handle missing optional fields
            const document = createInvitationDocument(minimalData);
            const formatted = formatInvitationForDisplay(document);
            
            // Required fields should be present
            expect(formatted.email).toBeTruthy();
            expect(formatted.role).toBeTruthy();
            expect(formatted.status).toBeTruthy();
            
            // Optional fields should be handled gracefully
            if (!minimalData.message) {
              expect(formatted.message).toBeFalsy(); // Can be null or undefined
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('multiple invitations formatting maintains consistency', () => {
      fc.assert(
        fc.property(
          fc.array(validInvitationDataGen(), { minLength: 2, maxLength: 10 }),
          (invitationDataArray) => {
            // Property: Multiple invitations should be formatted consistently
            const documents = invitationDataArray.map(data => createInvitationDocument(data));
            const formatted = documents.map(formatInvitationForDisplay);
            
            // All formatted invitations should have consistent structure
            formatted.forEach(invitation => {
              expect(invitation).toHaveProperty('id');
              expect(invitation).toHaveProperty('email');
              expect(invitation).toHaveProperty('role');
              expect(invitation).toHaveProperty('status');
              expect(invitation).toHaveProperty('createdAt');
              expect(invitation).toHaveProperty('expiresAt');
              expect(invitation).toHaveProperty('inviterName');
              expect(invitation).toHaveProperty('organizationName');
              
              // Sensitive fields should be excluded
              expect(invitation).not.toHaveProperty('token');
              expect(invitation).not.toHaveProperty('_id');
            });
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Pagination Parameter Validation Properties', () => {
    
    test('pagination parameters are normalized correctly', () => {
      fc.assert(
        fc.property(
          fc.record({
            page: fc.option(fc.integer({ min: -10, max: 1000 })),
            limit: fc.option(fc.integer({ min: -10, max: 200 }))
          }),
          (params) => {
            // Property: Pagination parameters should be normalized to valid ranges
            const validated = validatePaginationParams(params);
            
            // Page should be at least 1
            expect(validated.page).toBeGreaterThanOrEqual(1);
            
            // Limit should be between 1 and 100
            expect(validated.limit).toBeGreaterThanOrEqual(1);
            expect(validated.limit).toBeLessThanOrEqual(100);
            
            // Skip should be calculated correctly
            expect(validated.skip).toBe((validated.page - 1) * validated.limit);
            expect(validated.skip).toBeGreaterThanOrEqual(0);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('pagination defaults are applied when parameters are missing', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(undefined, null, {}, { page: null }, { limit: null }),
          (params) => {
            // Property: Missing pagination parameters should use defaults
            const validated = validatePaginationParams(params);
            
            expect(validated.page).toBe(1);
            expect(validated.limit).toBe(20);
            expect(validated.skip).toBe(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Filter Parameter Validation Properties', () => {
    
    test('valid filters are preserved', () => {
      fc.assert(
        fc.property(
          fc.record({
            status: fc.option(validInvitationStatusGen()),
            role: fc.option(validTeamRoleGen()),
            organizationId: fc.option(validObjectIdGen()),
            invitedBy: fc.option(validObjectIdGen())
          }),
          (filters) => {
            // Property: Valid filters should be preserved
            const validated = validateInvitationFilters(filters);
            
            if (filters.status) {
              expect(validated.status).toBe(filters.status);
            }
            
            if (filters.role) {
              expect(validated.role).toBe(filters.role);
            }
            
            if (filters.organizationId) {
              expect(validated.organizationId).toBeInstanceOf(ObjectId);
              expect(validated.organizationId.toString()).toBe(filters.organizationId);
            }
            
            if (filters.invitedBy) {
              expect(validated.invitedBy).toBeInstanceOf(ObjectId);
              expect(validated.invitedBy.toString()).toBe(filters.invitedBy);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('invalid filters are excluded', () => {
      fc.assert(
        fc.property(
          fc.record({
            status: fc.option(fc.string().filter(s => !Object.values(INVITATION_STATUS).includes(s))),
            role: fc.option(fc.string().filter(s => !Object.values(TEAM_ROLES).includes(s))),
            organizationId: fc.option(fc.string().filter(s => !ObjectId.isValid(s))),
            invitedBy: fc.option(fc.string().filter(s => !ObjectId.isValid(s)))
          }),
          (invalidFilters) => {
            // Property: Invalid filters should be excluded
            const validated = validateInvitationFilters(invalidFilters);
            
            if (invalidFilters.status) {
              expect(validated.status).toBeUndefined();
            }
            
            if (invalidFilters.role) {
              expect(validated.role).toBeUndefined();
            }
            
            if (invalidFilters.organizationId) {
              expect(validated.organizationId).toBeUndefined();
            }
            
            if (invalidFilters.invitedBy) {
              expect(validated.invitedBy).toBeUndefined();
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('empty filters return empty object', () => {
      fc.assert(
        fc.property(
          fc.constantFrom(undefined, null, {}, { status: null }, { role: '' }),
          (emptyFilters) => {
            // Property: Empty filters should return empty object
            const validated = validateInvitationFilters(emptyFilters);
            
            expect(Object.keys(validated)).toHaveLength(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});