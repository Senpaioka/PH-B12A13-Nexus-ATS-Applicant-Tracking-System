/**
 * Property-Based Tests for Interview Validation
 * Feature: interview-scheduling, Property 2: Input Validation and Error Handling
 * Feature: interview-scheduling, Property 5: Date and Time Validation
 * Validates: Requirements 1.4, 2.5, 6.1, 6.4, 6.5, 2.3, 6.2, 6.3
 */

import fc from 'fast-check';
import { ObjectId } from 'mongodb';
import {
  validateInterviewData,
  validateDateTimeConstraints,
  validateInterviewers,
  validateMeetingDetails,
  sanitizeInterviewInput,
  ValidationError
} from '../interview-validation.js';
import {
  INTERVIEW_TYPES,
  INTERVIEW_STATUS,
  MEETING_TYPES
} from '../interview-models.js';

// Helper generators for valid data
const validObjectIdGen = () => fc.string().map(() => new ObjectId().toString());

const validDateGen = () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const oneYearFromNow = new Date();
  oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
  
  return fc.date({ min: tomorrow, max: oneYearFromNow })
    .filter(date => !isNaN(date.getTime()))
    .map(date => date.toISOString().split('T')[0]);
};

const validTimeGen = () => fc.integer({ min: 8, max: 17 })
  .chain(hour => fc.integer({ min: 0, max: 59 })
    .map(minute => `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`));

const validInterviewTypeGen = () => fc.constantFrom(...Object.values(INTERVIEW_TYPES));
const validInterviewStatusGen = () => fc.constantFrom(...Object.values(INTERVIEW_STATUS));
const validMeetingTypeGen = () => fc.constantFrom(...Object.values(MEETING_TYPES));

const validInterviewerNamesGen = () => fc.array(
  fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
  { minLength: 0, maxLength: 10 }
);

const validUrlGen = () => fc.oneof(
  fc.constant('https://meet.google.com/abc-defg-hij'),
  fc.constant('https://zoom.us/j/123456789'),
  fc.constant('https://teams.microsoft.com/l/meetup-join/123')
);

const validInterviewDataGen = () => fc.record({
  candidateId: validObjectIdGen(),
  candidateName: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
  jobId: validObjectIdGen(),
  jobTitle: fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
  date: validDateGen(),
  time: validTimeGen(),
  type: validInterviewTypeGen(),
  duration: fc.integer({ min: 15, max: 480 }).filter(d => d % 15 === 0),
  interviewers: validInterviewerNamesGen(),
  meetingType: validMeetingTypeGen(),
  meetingLink: fc.option(validUrlGen()),
  location: fc.option(fc.string({ minLength: 1, maxLength: 200 })),
  notes: fc.option(fc.string({ maxLength: 2000 })),
  status: fc.option(validInterviewStatusGen())
}).map(data => {
  // Ensure video meetings have links and in-person meetings have locations
  if (data.meetingType === MEETING_TYPES.VIDEO && !data.meetingLink) {
    data.meetingLink = 'https://meet.google.com/abc-defg-hij';
  }
  if (data.meetingType === MEETING_TYPES.IN_PERSON && !data.location) {
    data.location = 'Conference Room A';
  }
  return data;
});

describe('Interview Validation Property Tests', () => {
  
  /**
   * Property 2: Input Validation and Error Handling
   * For any interview data with missing required fields or invalid formats, 
   * the system should reject the request and return descriptive error messages 
   * indicating which fields are invalid.
   */
  describe('Property 2: Input Validation and Error Handling', () => {
    
    test('validates complete valid interview data successfully', () => {
      fc.assert(
        fc.property(
          validInterviewDataGen(),
          (interviewData) => {
            // Property: Valid data should pass validation without throwing
            expect(() => validateInterviewData(interviewData)).not.toThrow();
          }
        ),
        { numRuns: 100 }
      );
    });

    test('rejects interview data with missing required fields', () => {
      fc.assert(
        fc.property(
          fc.record({
            // Intentionally missing required fields
            candidateId: fc.option(validObjectIdGen()),
            candidateName: fc.option(fc.string()),
            jobId: fc.option(validObjectIdGen()),
            jobTitle: fc.option(fc.string()),
            date: fc.option(validDateGen()),
            time: fc.option(validTimeGen()),
            type: fc.option(validInterviewTypeGen())
          }),
          (incompleteData) => {
            // Property: Missing required fields should cause validation to fail
            const hasAllRequired = incompleteData.candidateId && 
                                 incompleteData.candidateName && 
                                 incompleteData.jobId && 
                                 incompleteData.jobTitle && 
                                 incompleteData.date && 
                                 incompleteData.time && 
                                 incompleteData.type;

            if (!hasAllRequired) {
              expect(() => validateInterviewData(incompleteData)).toThrow(ValidationError);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('rejects interview data with invalid ObjectIds', () => {
      fc.assert(
        fc.property(
          fc.record({
            candidateId: fc.string().filter(s => !ObjectId.isValid(s)),
            candidateName: fc.string({ minLength: 1, maxLength: 100 }),
            jobId: validObjectIdGen(),
            jobTitle: fc.string({ minLength: 1, maxLength: 100 }),
            date: validDateGen(),
            time: validTimeGen(),
            type: validInterviewTypeGen()
          }),
          (invalidData) => {
            // Property: Invalid ObjectIds should cause validation to fail
            expect(() => validateInterviewData(invalidData)).toThrow(ValidationError);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('rejects interview data with invalid enum values', () => {
      fc.assert(
        fc.property(
          fc.record({
            candidateId: validObjectIdGen(),
            candidateName: fc.string({ minLength: 1, maxLength: 100 }),
            jobId: validObjectIdGen(),
            jobTitle: fc.string({ minLength: 1, maxLength: 100 }),
            date: validDateGen(),
            time: validTimeGen(),
            type: fc.string().filter(s => !Object.values(INTERVIEW_TYPES).includes(s))
          }),
          (invalidData) => {
            // Property: Invalid enum values should cause validation to fail
            expect(() => validateInterviewData(invalidData)).toThrow(ValidationError);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('provides descriptive error messages for validation failures', () => {
      fc.assert(
        fc.property(
          fc.record({
            candidateId: fc.constant('invalid-id'),
            candidateName: fc.constant(''),
            jobId: fc.constant('invalid-job-id'),
            jobTitle: fc.constant(''),
            date: fc.constant('invalid-date'),
            time: fc.constant('invalid-time'),
            type: fc.constant('invalid-type')
          }),
          (invalidData) => {
            // Property: Validation errors should contain descriptive messages
            try {
              validateInterviewData(invalidData);
              // Should not reach here
              expect(true).toBe(false);
            } catch (error) {
              expect(error).toBeInstanceOf(ValidationError);
              expect(error.message).toBeTruthy();
              expect(typeof error.message).toBe('string');
              expect(error.message.length).toBeGreaterThan(0);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  /**
   * Property 5: Date and Time Validation
   * For any interview with date and time information, the system should validate 
   * that dates are not in the past, times follow proper format, and date/time 
   * constraints are enforced.
   */
  describe('Property 5: Date and Time Validation', () => {
    
    test('accepts valid future dates and business hours', () => {
      fc.assert(
        fc.property(
          validDateGen(),
          validTimeGen(),
          (date, time) => {
            // Property: Valid future dates and business hours should pass validation
            expect(() => validateDateTimeConstraints(date, time)).not.toThrow();
          }
        ),
        { numRuns: 100 }
      );
    });

    test('rejects past dates', () => {
      fc.assert(
        fc.property(
          fc.date({ max: new Date(Date.now() - 24 * 60 * 60 * 1000) }) // At least 1 day ago
            .map(date => date.toISOString().split('T')[0]),
          validTimeGen(),
          (pastDate, time) => {
            // Property: Past dates should be rejected
            expect(() => validateDateTimeConstraints(pastDate, time)).toThrow(ValidationError);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('rejects times outside business hours', () => {
      fc.assert(
        fc.property(
          validDateGen(),
          fc.oneof(
            fc.integer({ min: 0, max: 7 }).map(h => `${h.toString().padStart(2, '0')}:00`), // Before 8 AM
            fc.integer({ min: 19, max: 23 }).map(h => `${h}:00`) // After 6 PM
          ),
          (date, invalidTime) => {
            // Property: Times outside business hours should be rejected
            expect(() => validateDateTimeConstraints(date, invalidTime)).toThrow(ValidationError);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('rejects invalid date formats', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.string().filter(s => !/^\d{4}-\d{2}-\d{2}$/.test(s)),
            fc.constant('2024-13-01'), // Invalid month
            fc.constant('2024-02-30'), // Invalid day
            fc.constant('not-a-date')
          ),
          validTimeGen(),
          (invalidDate, time) => {
            // Property: Invalid date formats should be rejected
            expect(() => validateDateTimeConstraints(invalidDate, time)).toThrow(ValidationError);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('rejects invalid time formats', () => {
      fc.assert(
        fc.property(
          validDateGen(),
          fc.oneof(
            fc.string().filter(s => !/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(s)),
            fc.constant('25:00'), // Invalid hour
            fc.constant('12:60'), // Invalid minute
            fc.constant('not-a-time')
          ),
          (date, invalidTime) => {
            // Property: Invalid time formats should be rejected
            expect(() => validateDateTimeConstraints(date, invalidTime)).toThrow(ValidationError);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('rejects dates too far in the future', () => {
      fc.assert(
        fc.property(
          fc.date({ min: new Date(Date.now() + 2 * 365 * 24 * 60 * 60 * 1000) }) // More than 1 year from now
            .map(date => date.toISOString().split('T')[0]),
          validTimeGen(),
          (farFutureDate, time) => {
            // Property: Dates more than one year in the future should be rejected
            expect(() => validateDateTimeConstraints(farFutureDate, time)).toThrow(ValidationError);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Interviewer Validation Properties', () => {
    
    test('accepts valid interviewer arrays', () => {
      fc.assert(
        fc.property(
          validInterviewerNamesGen(),
          (interviewers) => {
            // Property: Valid interviewer arrays should pass validation
            expect(() => validateInterviewers(interviewers)).not.toThrow();
          }
        ),
        { numRuns: 100 }
      );
    });

    test('rejects arrays with too many interviewers', () => {
      fc.assert(
        fc.property(
          fc.array(fc.string({ minLength: 1, maxLength: 100 }), { minLength: 11, maxLength: 20 }),
          (tooManyInterviewers) => {
            // Property: Arrays with more than 10 interviewers should be rejected
            expect(() => validateInterviewers(tooManyInterviewers)).toThrow(ValidationError);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('rejects duplicate interviewer names', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 100 }).filter(s => s.trim().length > 0),
          (name) => {
            const duplicateNames = [name, name, name]; // Same name repeated
            // Property: Duplicate names should be rejected
            expect(() => validateInterviewers(duplicateNames)).toThrow(ValidationError);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Meeting Details Validation Properties', () => {
    
    test('requires meeting link for video interviews', () => {
      fc.assert(
        fc.property(
          fc.constant(MEETING_TYPES.VIDEO),
          (meetingType) => {
            const meetingDetails = { type: meetingType, link: null, location: null };
            // Property: Video meetings without links should be rejected
            expect(() => validateMeetingDetails(meetingDetails)).toThrow(ValidationError);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('requires location for in-person interviews', () => {
      fc.assert(
        fc.property(
          fc.constant(MEETING_TYPES.IN_PERSON),
          (meetingType) => {
            const meetingDetails = { type: meetingType, link: null, location: null };
            // Property: In-person meetings without location should be rejected
            expect(() => validateMeetingDetails(meetingDetails)).toThrow(ValidationError);
          }
        ),
        { numRuns: 100 }
      );
    });

    test('accepts valid URLs for meeting links', () => {
      fc.assert(
        fc.property(
          validUrlGen(),
          (validUrl) => {
            const meetingDetails = { type: MEETING_TYPES.VIDEO, link: validUrl, location: null };
            // Property: Valid URLs should pass validation
            expect(() => validateMeetingDetails(meetingDetails)).not.toThrow();
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Data Sanitization Properties', () => {
    
    test('sanitization preserves valid data structure', () => {
      fc.assert(
        fc.property(
          validInterviewDataGen(),
          (validData) => {
            // Property: Sanitization should preserve the structure of valid data
            const sanitized = sanitizeInterviewInput(validData);
            
            expect(typeof sanitized).toBe('object');
            expect(sanitized).not.toBeNull();
            
            // Check that required fields are preserved
            if (validData.candidateName) {
              expect(sanitized.candidateName).toBeTruthy();
            }
            if (validData.jobTitle) {
              expect(sanitized.jobTitle).toBeTruthy();
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    test('sanitization handles invalid input gracefully', () => {
      fc.assert(
        fc.property(
          fc.oneof(
            fc.constant(null),
            fc.constant(undefined),
            fc.constant('not an object'),
            fc.constant(123),
            fc.constant([])
          ),
          (invalidInput) => {
            // Property: Invalid input should be handled gracefully
            const result = sanitizeInterviewInput(invalidInput);
            expect(typeof result).toBe('object');
            expect(result).not.toBeNull();
          }
        ),
        { numRuns: 100 }
      );
    });

    test('sanitization trims whitespace from string fields', () => {
      fc.assert(
        fc.property(
          fc.record({
            candidateName: fc.string().map(s => `  ${s}  `), // Add whitespace
            jobTitle: fc.string().map(s => `\t${s}\n`), // Add tabs and newlines
            notes: fc.string().map(s => `   ${s}   `)
          }),
          (dataWithWhitespace) => {
            // Property: Whitespace should be trimmed from string fields
            const sanitized = sanitizeInterviewInput(dataWithWhitespace);
            
            if (sanitized.candidateName) {
              expect(sanitized.candidateName).not.toMatch(/^\s/);
              expect(sanitized.candidateName).not.toMatch(/\s$/);
            }
            if (sanitized.jobTitle) {
              expect(sanitized.jobTitle).not.toMatch(/^\s/);
              expect(sanitized.jobTitle).not.toMatch(/\s$/);
            }
            if (sanitized.notes) {
              expect(sanitized.notes).not.toMatch(/^\s/);
              expect(sanitized.notes).not.toMatch(/\s$/);
            }
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});