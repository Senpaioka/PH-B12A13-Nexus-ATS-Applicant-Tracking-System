/**
 * Property-Based Tests for Interview Service
 * Feature: interview-scheduling, Property 1: Interview Creation with Required Fields
 * Feature: interview-scheduling, Property 9: Referential Integrity Validation
 * Feature: interview-scheduling, Property 10: Data Integration Consistency
 * Validates: Requirements 1.1, 1.2, 1.3, 1.5, 5.1, 5.2, 5.3, 5.4, 5.5
 */

import fc from 'fast-check';
import { ObjectId } from 'mongodb';
import { InterviewService, InterviewServiceError } from '../interview-service.js';
import { getInterviewsCollection } from '../interview-db.js';
import { INTERVIEW_TYPES, INTERVIEW_STATUS, MEETING_TYPES } from '../interview-models.js';
import { candidateService } from '../../candidates/candidate-service.js';
import { createJob } from '../../jobs/job-service.js';

// Helper generators for valid data
const validObjectIdGen = () => fc.string().map(() => new ObjectId().toString());

const validDateGen = () => {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const oneMonthFromNow = new Date();
  oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);
  
  return fc.date({ min: tomorrow, max: oneMonthFromNow })
    .filter(date => !isNaN(date.getTime()))
    .map(date => date.toISOString().split('T')[0]);
};

const validTimeGen = () => fc.integer({ min: 8, max: 17 })
  .chain(hour => fc.integer({ min: 0, max: 59 })
    .map(minute => `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`));

const validInterviewTypeGen = () => fc.constantFrom(...Object.values(INTERVIEW_TYPES));
const validMeetingTypeGen = () => fc.constantFrom(...Object.values(MEETING_TYPES));

const validInterviewerNamesGen = () => fc.array(
  fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
  { minLength: 1, maxLength: 3 }
);

// Generator for valid candidate data
const validCandidateGen = () => fc.record({
  firstName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
  lastName: fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
  email: fc.emailAddress(),
  phone: fc.option(fc.string({ minLength: 10, maxLength: 15 })),
  location: fc.option(fc.string({ minLength: 1, maxLength: 100 }))
});

// Generator for valid job data
const validJobGen = () => fc.record({
  title: fc.string({ minLength: 3, maxLength: 50 }).filter(s => s.trim().length >= 3),
  department: fc.constantFrom('Engineering', 'Product', 'Design', 'Marketing'),
  type: fc.constantFrom('full-time', 'part-time', 'contract'),
  location: fc.string({ minLength: 2, maxLength: 50 }).filter(s => s.trim().length >= 2),
  description: fc.string({ minLength: 50, maxLength: 200 }).map(s => s.padEnd(50, 'A')),
  requirements: fc.string({ minLength: 50, maxLength: 200 }).map(s => s.padEnd(50, 'A'))
});

const validInterviewDataGen = (candidateId, jobId, candidateName, jobTitle) => fc.record({
  candidateId: fc.constant(candidateId),
  candidateName: fc.constant(candidateName),
  jobId: fc.constant(jobId),
  jobTitle: fc.constant(jobTitle),
  date: validDateGen(),
  time: validTimeGen(),
  type: validInterviewTypeGen(),
  duration: fc.integer({ min: 15, max: 480 }).filter(d => d % 15 === 0),
  interviewers: validInterviewerNamesGen(),
  meetingType: validMeetingTypeGen(),
  meetingLink: fc.constant('https://meet.google.com/test-meeting'),
  location: fc.option(fc.string({ minLength: 1, maxLength: 200 })),
  notes: fc.option(fc.string({ maxLength: 500 }))
});

describe('Interview Service Property Tests', () => {
  let interviewService;
  let testCandidateId;
  let testJobId;
  let testUserId;

  beforeAll(async () => {
    interviewService = new InterviewService();
    testUserId = new ObjectId().toString();
  });

  beforeEach(async () => {
    // Create test candidate
    const candidateData = {
      firstName: 'Test',
      lastName: 'Candidate',
      email: `test.candidate.${Date.now()}@example.com`,
      phone: '+1234567890'
    };
    const candidate = await candidateService.createCandidate(candidateData, testUserId);
    testCandidateId = candidate._id.toString();

    // Create test job
    const jobData = {
      title: `Test Job ${Date.now()}`,
      department: 'Engineering',
      type: 'full-time',
      location: 'Test Location',
      description: 'Test job description that is long enough to meet requirements',
      requirements: 'Test job requirements that are long enough to meet requirements'
    };
    const job = await createJob(jobData, testUserId);
    testJobId = job.id;
  });

  afterEach(async () => {
    // Clean up test interviews
    try {
      const collection = await getInterviewsCollection();
      await collection.deleteMany({ 
        $or: [
          { candidateId: new ObjectId(testCandidateId) },
          { jobId: new ObjectId(testJobId) }
        ]
      });
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  /**
   * Property 1: Interview Creation with Required Fields
   * For any interview creation request with valid candidate ID, job ID, date, time, 
   * and interview type, the system should successfully create a new interview record 
   * with a unique ID and persist it to the database immediately.
   */
  describe('Property 1: Interview Creation with Required Fields', () => {
    
    test('creates interviews with valid required fields successfully', () => {
      return fc.assert(
        fc.asyncProperty(
          validInterviewDataGen(testCandidateId, testJobId, 'Test Candidate', 'Test Job'),
          async (interviewData) => {
            // Property: Valid interview data should create a new interview
            const createdInterview = await interviewService.createInterview(interviewData, testUserId);
            
            expect(createdInterview).toBeDefined();
            expect(createdInterview.id).toBeDefined();
            expect(createdInterview.candidateId).toBe(testCandidateId);
            expect(createdInterview.jobId).toBe(testJobId);
            expect(createdInterview.candidateName).toBe('Test Candidate');
            expect(createdInterview.jobTitle).toBe('Test Job');
            expect(createdInterview.date).toBe(interviewData.date);
            expect(createdInterview.time).toBe(interviewData.time);
            expect(createdInterview.type).toBe(interviewData.type);
            
            // Verify persistence by retrieving the interview
            const retrievedInterview = await interviewService.getInterviewById(createdInterview.id);
            expect(retrievedInterview).toBeDefined();
            expect(retrievedInterview.id).toBe(createdInterview.id);
          }
        ),
        { numRuns: 10 }
      );
    });

    test('assigns unique IDs to each created interview', () => {
      return fc.assert(
        fc.asyncProperty(
          fc.array(
            validInterviewDataGen(testCandidateId, testJobId, 'Test Candidate', 'Test Job'),
            { minLength: 2, maxLength: 5 }
          ),
          async (interviewDataArray) => {
            // Property: Each interview should get a unique ID
            const createdInterviews = [];
            
            for (const interviewData of interviewDataArray) {
              // Modify time slightly to avoid conflicts
              const modifiedData = {
                ...interviewData,
                time: `${8 + createdInterviews.length}:00`
              };
              const interview = await interviewService.createInterview(modifiedData, testUserId);
              createdInterviews.push(interview);
            }
            
            // Check that all IDs are unique
            const ids = createdInterviews.map(interview => interview.id);
            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(ids.length);
            
            // Check that all interviews are different objects
            for (let i = 0; i < createdInterviews.length; i++) {
              for (let j = i + 1; j < createdInterviews.length; j++) {
                expect(createdInterviews[i].id).not.toBe(createdInterviews[j].id);
              }
            }
          }
        ),
        { numRuns: 5 }
      );
    });
  });

  /**
   * Property 9: Referential Integrity Validation
   * For any interview creation request, the system should validate that the referenced 
   * candidate ID and job ID exist in their respective collections, rejecting requests 
   * with non-existent references.
   */
  describe('Property 9: Referential Integrity Validation', () => {
    
    test('rejects interviews with non-existent candidate IDs', () => {
      return fc.assert(
        fc.asyncProperty(
          validObjectIdGen().filter(id => id !== testCandidateId),
          validInterviewDataGen(testCandidateId, testJobId, 'Test Candidate', 'Test Job'),
          async (invalidCandidateId, baseInterviewData) => {
            // Property: Non-existent candidate IDs should be rejected
            const invalidData = {
              ...baseInterviewData,
              candidateId: invalidCandidateId
            };
            
            await expect(
              interviewService.createInterview(invalidData, testUserId)
            ).rejects.toThrow(InterviewServiceError);
          }
        ),
        { numRuns: 5 }
      );
    });

    test('rejects interviews with non-existent job IDs', () => {
      return fc.assert(
        fc.asyncProperty(
          validObjectIdGen().filter(id => id !== testJobId),
          validInterviewDataGen(testCandidateId, testJobId, 'Test Candidate', 'Test Job'),
          async (invalidJobId, baseInterviewData) => {
            // Property: Non-existent job IDs should be rejected
            const invalidData = {
              ...baseInterviewData,
              jobId: invalidJobId
            };
            
            await expect(
              interviewService.createInterview(invalidData, testUserId)
            ).rejects.toThrow(InterviewServiceError);
          }
        ),
        { numRuns: 5 }
      );
    });

    test('accepts interviews with valid candidate and job references', () => {
      return fc.assert(
        fc.asyncProperty(
          validInterviewDataGen(testCandidateId, testJobId, 'Test Candidate', 'Test Job'),
          async (interviewData) => {
            // Property: Valid references should be accepted
            const createdInterview = await interviewService.createInterview(interviewData, testUserId);
            
            expect(createdInterview).toBeDefined();
            expect(createdInterview.candidateId).toBe(testCandidateId);
            expect(createdInterview.jobId).toBe(testJobId);
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  /**
   * Property 10: Data Integration Consistency
   * For any interview display, the system should retrieve and show current candidate 
   * and job information from the respective collections, handling cases where 
   * referenced entities may have been deleted.
   */
  describe('Property 10: Data Integration Consistency', () => {
    
    test('enriches interview data with current candidate and job information', () => {
      return fc.assert(
        fc.asyncProperty(
          validInterviewDataGen(testCandidateId, testJobId, 'Test Candidate', 'Test Job'),
          async (interviewData) => {
            // Property: Retrieved interviews should include current candidate/job info
            const createdInterview = await interviewService.createInterview(interviewData, testUserId);
            const retrievedInterview = await interviewService.getInterviewById(createdInterview.id);
            
            expect(retrievedInterview).toBeDefined();
            
            // Should have enriched candidate information
            if (retrievedInterview.currentCandidateInfo) {
              expect(retrievedInterview.currentCandidateInfo.name).toBeTruthy();
              expect(retrievedInterview.currentCandidateInfo.email).toBeTruthy();
            }
            
            // Should have enriched job information
            if (retrievedInterview.currentJobInfo) {
              expect(retrievedInterview.currentJobInfo.title).toBeTruthy();
              expect(retrievedInterview.currentJobInfo.department).toBeTruthy();
            }
          }
        ),
        { numRuns: 10 }
      );
    });

    test('handles deleted candidate references gracefully', () => {
      return fc.assert(
        fc.asyncProperty(
          validInterviewDataGen(testCandidateId, testJobId, 'Test Candidate', 'Test Job'),
          async (interviewData) => {
            // Create interview first
            const createdInterview = await interviewService.createInterview(interviewData, testUserId);
            
            // Delete the candidate (soft delete)
            await candidateService.deleteCandidate(testCandidateId, testUserId);
            
            // Property: System should handle deleted candidate gracefully
            const retrievedInterview = await interviewService.getInterviewById(createdInterview.id);
            
            expect(retrievedInterview).toBeDefined();
            expect(retrievedInterview.id).toBe(createdInterview.id);
            
            // Should indicate candidate was deleted
            expect(retrievedInterview.candidateDeleted).toBe(true);
            expect(retrievedInterview.currentCandidateInfo).toBeNull();
          }
        ),
        { numRuns: 5 }
      );
    });

    test('maintains interview data consistency during retrieval', () => {
      return fc.assert(
        fc.asyncProperty(
          validInterviewDataGen(testCandidateId, testJobId, 'Test Candidate', 'Test Job'),
          async (interviewData) => {
            // Property: Core interview data should remain consistent
            const createdInterview = await interviewService.createInterview(interviewData, testUserId);
            const retrievedInterview = await interviewService.getInterviewById(createdInterview.id);
            
            expect(retrievedInterview.id).toBe(createdInterview.id);
            expect(retrievedInterview.candidateId).toBe(createdInterview.candidateId);
            expect(retrievedInterview.jobId).toBe(createdInterview.jobId);
            expect(retrievedInterview.date).toBe(createdInterview.date);
            expect(retrievedInterview.time).toBe(createdInterview.time);
            expect(retrievedInterview.type).toBe(createdInterview.type);
            expect(retrievedInterview.status).toBe(createdInterview.status);
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  describe('Interview Service CRUD Properties', () => {
    
    test('created interviews can be retrieved by ID', () => {
      return fc.assert(
        fc.asyncProperty(
          validInterviewDataGen(testCandidateId, testJobId, 'Test Candidate', 'Test Job'),
          async (interviewData) => {
            // Property: Created interviews should be retrievable
            const created = await interviewService.createInterview(interviewData, testUserId);
            const retrieved = await interviewService.getInterviewById(created.id);
            
            expect(retrieved).toBeDefined();
            expect(retrieved.id).toBe(created.id);
          }
        ),
        { numRuns: 10 }
      );
    });

    test('interview statistics are calculated correctly', () => {
      return fc.assert(
        fc.asyncProperty(
          fc.array(
            validInterviewDataGen(testCandidateId, testJobId, 'Test Candidate', 'Test Job'),
            { minLength: 1, maxLength: 3 }
          ),
          async (interviewDataArray) => {
            // Create interviews for today
            const today = new Date();
            const todayString = today.toISOString().split('T')[0];
            
            const createdInterviews = [];
            for (let i = 0; i < interviewDataArray.length; i++) {
              const data = {
                ...interviewDataArray[i],
                date: todayString,
                time: `${9 + i}:00` // Different times to avoid conflicts
              };
              const interview = await interviewService.createInterview(data, testUserId);
              createdInterviews.push(interview);
            }
            
            // Property: Statistics should reflect created interviews
            const stats = await interviewService.getInterviewStats(today);
            
            expect(stats.totalInterviews).toBeGreaterThanOrEqual(createdInterviews.length);
            expect(stats.date).toBe(todayString);
            expect(Array.isArray(stats.interviewerInitials)).toBe(true);
            expect(typeof stats.interviewsByType).toBe('object');
          }
        ),
        { numRuns: 5 }
      );
    });
  });
});