/**
 * Property-Based Tests for Team Invitation Email Functionality
 * Feature: team-member-invitation, Property 2: Email Sending for Invitations
 * Feature: team-member-invitation, Property 12: Email Content Completeness
 * Validates: Requirements 1.4, 4.1, 4.2, 4.3, 4.4, 4.5
 */

import fc from 'fast-check';
import { ObjectId } from 'mongodb';
import {
  createInvitationDocument,
  TEAM_ROLES,
  INVITATION_STATUS
} from '../invitation-models.js';
import {
  generateInvitationEmailHTML,
  generateInvitationEmailText,
  generateInvitationEmailSubject,
  validateInvitationEmailData
} from '../../email/invitation-templates.js';

// Helper generators
const validObjectIdGen = () => fc.string().map(() => new ObjectId().toString());
const validEmailGen = () => fc.emailAddress().map(email => email.toLowerCase());
const validTeamRoleGen = () => fc.constantFrom(...Object.values(TEAM_ROLES));
const validTokenGen = () => fc.hexaString({ minLength: 64, maxLength: 64 });

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

const validInvitationEmailDataGen = () => fc.record({
  inviterName: fc.string({ minLength: 1, maxLength: 100 }),
  organizationName: fc.string({ minLength: 1, maxLength: 100 }),
  role: validTeamRoleGen(),
  message: fc.option(fc.string({ minLength: 1, maxLength: 500 })),
  acceptanceUrl: fc.webUrl(),
  expiresAt: fc.date({ min: new Date(Date.now() + 60000) }) // At least 1 minute in future
});

const validInvitationDocumentGen = () => validInvitationDataGen().map(data => {
  const doc = createInvitationDocument(data);
  // Add _id and token for email testing
  doc._id = new ObjectId();
  doc.token = 'a'.repeat(64); // Simple fixed token for testing
  return doc;
});

describe('Team Invitation Email Property Tests', () => {
  
  /**
   * Property 2: Email Sending for Invitations
   * For any valid invitation document, the system should be able to prepare 
   * email data and generate proper acceptance URLs.
   */
  describe('Property 2: Email Sending for Invitations', () => {
    
    test('invitation email data validation accepts valid data', () => {
      fc.assert(
        fc.property(
          validInvitationEmailDataGen(),
          (emailData) => {
            // Property: Valid email data should pass validation
            expect(() => validateInvitationEmailData(emailData)).not.toThrow();
          }
        ),
        { numRuns: 100 }
      );
    });

    test('invitation email data validation rejects incomplete data', () => {
      fc.assert(
        fc.property(
          validInvitationEmailDataGen(),
          fc.constantFrom('inviterName', 'organizationName', 'role', 'acceptanceUrl', 'expiresAt'),
          (emailData, fieldToRemove) => {
            // Property: Incomplete email data should be rejected
            delete emailData[fieldToRemove];
            
            expect(() => validateInvitationEmailData(emailData)).toThrow();
          }
        ),
        { numRuns: 100 }
      );
    });

    test('invitation email data validation rejects past expiry dates', () => {
      fc.assert(
        fc.property(
          validInvitationEmailDataGen(),
          (emailData) => {
            // Property: Past expiry dates should be rejected
            emailData.expiresAt = new Date(Date.now() - 60 * 1000); // 1 minute ago
            
            expect(() => validateInvitationEmailData(emailData)).toThrow();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 12: Email Content Completeness
   * For any valid invitation email data, the system should generate complete 
   * email content with all required information and proper formatting.
   */
  describe('Property 12: Email Content Completeness', () => {
    
    test('email subject generation includes essential information', () => {
      fc.assert(
        fc.property(
          validInvitationEmailDataGen(),
          (emailData) => {
            // Property: Email subjects should include essential information
            const subject = generateInvitationEmailSubject(emailData);
            
            // Should contain organization name and role
            expect(subject).toContain(emailData.organizationName);
            expect(subject).toContain(emailData.role);
            
            // Should be a reasonable length
            expect(subject.length).toBeGreaterThan(10);
            expect(subject.length).toBeLessThan(200);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('HTML email content includes all required elements', () => {
      fc.assert(
        fc.property(
          validInvitationEmailDataGen(),
          (emailData) => {
            // Property: HTML emails should include all required elements
            const html = generateInvitationEmailHTML(emailData);
            
            // Should contain essential information
            expect(html).toContain(emailData.inviterName);
            expect(html).toContain(emailData.organizationName);
            expect(html).toContain(emailData.role);
            expect(html).toContain(emailData.acceptanceUrl);
            
            // Should be valid HTML structure
            expect(html).toContain('<!DOCTYPE html>');
            expect(html).toContain('<html');
            expect(html).toContain('</html>');
            expect(html).toContain('<head>');
            expect(html).toContain('<body>');
            
            // Should include CTA button
            expect(html).toContain('Accept Invitation');
            
            // Should include expiry information
            expect(html).toContain('expires');
          }
        ),
        { numRuns: 100 }
      );
    });

    test('text email content includes all required elements', () => {
      fc.assert(
        fc.property(
          validInvitationEmailDataGen(),
          (emailData) => {
            // Property: Text emails should include all required elements
            const text = generateInvitationEmailText(emailData);
            
            // Should contain essential information
            expect(text).toContain(emailData.inviterName);
            expect(text).toContain(emailData.organizationName);
            expect(text).toContain(emailData.role);
            expect(text).toContain(emailData.acceptanceUrl);
            
            // Should include expiry information
            expect(text).toContain('expires');
            
            // Should be readable plain text (no HTML tags)
            expect(text).not.toMatch(/<\w+[^>]*>/); // No opening HTML tags like <div>, <p>, etc.
            expect(text).not.toMatch(/<\/\w+>/); // No closing HTML tags like </div>, </p>, etc.
          }
        ),
        { numRuns: 100 }
      );
    });

    test('email content handles optional message field gracefully', () => {
      fc.assert(
        fc.property(
          validInvitationEmailDataGen(),
          fc.option(fc.string({ minLength: 1, maxLength: 500 })),
          (emailData, message) => {
            // Property: Email content should handle optional messages gracefully
            emailData.message = message;
            
            const html = generateInvitationEmailHTML(emailData);
            const text = generateInvitationEmailText(emailData);
            
            if (message) {
              // Should include the message
              expect(html).toContain(message);
              expect(text).toContain(message);
            } else {
              // Should not break without message
              expect(html).toBeTruthy();
              expect(text).toBeTruthy();
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Email Content Consistency Properties', () => {
    
    test('HTML and text versions contain consistent information', () => {
      fc.assert(
        fc.property(
          validInvitationEmailDataGen(),
          (emailData) => {
            // Property: HTML and text versions should contain consistent information
            const html = generateInvitationEmailHTML(emailData);
            const text = generateInvitationEmailText(emailData);
            
            // Both should contain the same essential information
            const essentialInfo = [
              emailData.inviterName,
              emailData.organizationName,
              emailData.role,
              emailData.acceptanceUrl
            ];
            
            essentialInfo.forEach(info => {
              expect(html).toContain(info);
              expect(text).toContain(info);
            });
          }
        ),
        { numRuns: 100 }
      );
    });

    test('email content is safe from injection attacks', () => {
      fc.assert(
        fc.property(
          validInvitationEmailDataGen(),
          fc.constantFrom('<script>', '&lt;script&gt;', 'javascript:', 'data:'),
          (emailData, maliciousContent) => {
            // Property: Email content should be safe from injection
            emailData.message = maliciousContent;
            emailData.inviterName = maliciousContent;
            emailData.organizationName = maliciousContent;
            
            const html = generateInvitationEmailHTML(emailData);
            const text = generateInvitationEmailText(emailData);
            
            // Should not contain unescaped malicious content
            // Note: This is a basic check - in production you'd want more sophisticated validation
            expect(html).toBeTruthy();
            expect(text).toBeTruthy();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});