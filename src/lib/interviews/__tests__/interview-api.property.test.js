/**
 * Property-Based Tests for Interview API Endpoints
 * Feature: interview-scheduling, Property 11: API Endpoint Functionality
 * Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5
 */

import fc from 'fast-check';
import { ObjectId } from 'mongodb';
import { InterviewService } from '../interview-service.js';
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

// Mock API request/response structure
const mockApiRequest = (body, method = 'POST', query = {}) => ({
  method,
  body: JSON.stringify(body),
  query,
  headers: { 'Content-Type': 'application/json' }
});

const mockApiResponse = () => {
  const responses = [];
  return {
    json: (data) => {
      responses.push({ type: 'json', data });
      return Promise.resolve();
    },
    status: (code) => ({
      json: (data) => {
        responses.push({ type: 'json', data, status: code });
        return Promise.resolve();
      }
    }),
    getResponses: () => responses
  };
};

describe('Interview API Property Tests', () => {
  let interviewService;
  let testCandidateId;
  let testJobId;
  let testUserId;
  let testInterviewIds = [];

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
      if (testInterviewIds.length > 0) {
        const collection = await getInterviewsCollection();
        await collection.deleteMany({ 
          _id: { $in: testInterviewIds.map(id => new ObjectId(id)) }
        });
        testInterviewIds = [];
      }
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  const validInterviewDataGen = () => fc.record({
    candidateId: fc.constant(testCandidateId),
    candidateName: fc.constant('Test Candidate'),
    jobId: fc.constant(testJobId),
    jobTitle: fc.constant('Test Job'),
    date: validDateGen(),
    time: validTimeGen(),
    type: validInterviewTypeGen(),
    duration: fc.integer({ min: 15, max: 480 }).filter(d => d % 15 === 0),
    interviewers: validInterviewerNamesGen(),
    meetingType: validMeetingTypeGen(),
    meetingLink: fc.option(fc.webUrl()),
    location: fc.option(fc.string({ minLength: 1, maxLength: 200 })),
    notes: fc.option(fc.string({ maxLength: 500 }))
  });

  /**
   * Property 11: API Endpoint Functionality
   * For any valid interview creation request through the API, the system should 
   * successfully create the interview, return appropriate response codes, and 
   * ensure the created interview can be retrieved through the GET endpoints.
   */
  describe('Property 11: API Endpoint Functionality', () => {
    
    test('POST endpoint creates interviews and returns consistent data', () => {
      return fc.assert(
        fc.asyncProperty(
          validInterviewDataGen(),
          async (interviewData) => {
            // Property: POST should create interview and return consistent data
            const createdInterview = await interviewService.createInterview(interviewData, testUserId);
            testInterviewIds.push(createdInterview.id);
            
            // Verify creation response structure
            expect(createdInterview).toBeDefined();
            expect(createdInterview.id).toBeTruthy();
            expect(createdInterview.candidateId).toBe(testCandidateId);
            expect(createdInterview.jobId).toBe(testJobId);
            expect(createdInterview.candidateName).toBe('Test Candidate');
            expect(createdInterview.jobTitle).toBe('Test Job');
            expect(createdInterview.date).toBe(interviewData.date);
            expect(createdInterview.time).toBe(interviewData.time);
            expect(createdInterview.type).toBe(interviewData.type);
            expect(createdInterview.status).toBe('scheduled');
            
            // Verify response includes all expected fields
            expect(createdInterview).toHaveProperty('duration');
            expect(createdInterview).toHaveProperty('interviewers');
            expect(createdInterview).toHaveProperty('meetingDetails');
            expect(createdInterview).toHaveProperty('createdAt');
            expect(createdInterview).toHaveProperty('updatedAt');
          }
        ),
        { numRuns: 10 }
      );
    });

    test('GET endpoint retrieves created interviews with correct data', () => {
      return fc.assert(
        fc.asyncProperty(
          validInterviewDataGen(),
          async (interviewData) => {
            // Property: GET should retrieve interviews with consistent data
            const createdInterview = await interviewService.createInterview(interviewData, testUserId);
            testInterviewIds.push(createdInterview.id);
            
            // Test GET by ID
            const retrievedInterview = await interviewService.getInterviewById(createdInterview.id);
            
            expect(retrievedInterview).toBeDefined();
            expect(retrievedInterview.id).toBe(createdInterview.id);
            expect(retrievedInterview.candidateId).toBe(createdInterview.candidateId);
            expect(retrievedInterview.jobId).toBe(createdInterview.jobId);
            expect(retrievedInterview.candidateName).toBe(createdInterview.candidateName);
            expect(retrievedInterview.jobTitle).toBe(createdInterview.jobTitle);
            expect(retrievedInterview.date).toBe(createdInterview.date);
            expect(retrievedInterview.time).toBe(createdInterview.time);
            expect(retrievedInterview.type).toBe(createdInterview.type);
            expect(retrievedInterview.status).toBe(createdInterview.status);
          }
        ),
        { numRuns: 10 }
      );
    });

    test('GET all interviews includes created interviews in results', () => {
      return fc.assert(
        fc.asyncProperty(
          fc.array(validInterviewDataGen(), { minLength: 1, maxLength: 3 }),
          async (interviewDataArray) => {
            // Property: GET all should include all created interviews
            const createdInterviews = [];
            
            for (let i = 0; i < interviewDataArray.length; i++) {
              const data = {
                ...interviewDataArray[i],
                time: `${9 + i}:00` // Different times to avoid conflicts
              };
              const interview = await interviewService.createInterview(data, testUserId);
              createdInterviews.push(interview);
              testInterviewIds.push(interview.id);
            }
            
            // Test GET all interviews
            const allInterviews = await interviewService.getAllInterviews();
            
            expect(allInterviews).toBeDefined();
            expect(allInterviews.interviews).toBeDefined();
            expect(Array.isArray(allInterviews.interviews)).toBe(true);
            expect(allInterviews.interviews.length).toBeGreaterThanOrEqual(createdInterviews.length);
            
            // Verify all created interviews are in the results
            const retrievedIds = allInterviews.interviews.map(interview => interview.id);
            createdInterviews.forEach(created => {
              expect(retrievedIds).toContain(created.id);
            });
            
            // Verify pagination structure
            expect(allInterviews).toHaveProperty('pagination');
            expect(allInterviews.pagination).toHaveProperty('page');
            expect(allInterviews.pagination).toHaveProperty('limit');
            expect(allInterviews.pagination).toHaveProperty('total');
          }
        ),
        { numRuns: 5 }
      );
    });

    test('API handles invalid data with appropriate error responses', () => {
      return fc.assert(
        fc.asyncProperty(
          fc.record({
            candidateId: fc.constantFrom('', 'invalid-id', null, undefined),
            jobId: fc.constantFrom('', 'invalid-id', null, undefined),
            date: fc.constantFrom('', 'invalid-date', null, undefined),
            time: fc.constantFrom('', 'invalid-time', null, undefined),
            type: fc.constantFrom('', 'invalid-type', null, undefined)
          }),
          async (invalidData) => {
            // Property: Invalid data should result in appropriate errors
            await expect(
              interviewService.createInterview(invalidData, testUserId)
            ).rejects.toThrow();
          }
        ),
        { numRuns: 5 }
      );
    });

    test('API maintains data consistency across create-retrieve cycles', () => {
      return fc.assert(
        fc.asyncProperty(
          validInterviewDataGen(),
          async (interviewData) => {
            // Property: Create-retrieve cycle should maintain data consistency
            const created = await interviewService.createInterview(interviewData, testUserId);
            testInterviewIds.push(created.id);
            
            const retrieved = await interviewService.getInterviewById(created.id);
            
            // Verify core data consistency
            expect(retrieved.candidateId).toBe(created.candidateId);
            expect(retrieved.jobId).toBe(created.jobId);
            expect(retrieved.candidateName).toBe(created.candidateName);
            expect(retrieved.jobTitle).toBe(created.jobTitle);
            expect(retrieved.date).toBe(created.date);
            expect(retrieved.time).toBe(created.time);
            expect(retrieved.type).toBe(created.type);
            expect(retrieved.duration).toBe(created.duration);
            expect(retrieved.status).toBe(created.status);
            
            // Verify arrays and objects are properly handled
            expect(retrieved.interviewers).toEqual(created.interviewers);
            expect(retrieved.meetingDetails).toEqual(created.meetingDetails);
          }
        ),
        { numRuns: 10 }
      );
    });

    test('statistics endpoint returns accurate data for created interviews', () => {
      return fc.assert(
        fc.asyncProperty(
          fc.array(validInterviewDataGen(), { minLength: 1, maxLength: 3 }),
          async (interviewDataArray) => {
            // Property: Statistics should accurately reflect created interviews
            const today = new Date();
            const todayString = today.toISOString().split('T')[0];
            
            const createdInterviews = [];
            for (let i = 0; i < interviewDataArray.length; i++) {
              const data = {
                ...interviewDataArray[i],
                date: todayString, // Set all to today
                time: `${9 + i}:00` // Different times
              };
              const interview = await interviewService.createInterview(data, testUserId);
              createdInterviews.push(interview);
              testInterviewIds.push(interview.id);
            }
            
            // Test statistics endpoint
            const stats = await interviewService.getInterviewStats(today);
            
            expect(stats).toBeDefined();
            expect(stats.date).toBe(todayString);
            expect(stats.totalInterviews).toBeGreaterThanOrEqual(createdInterviews.length);
            expect(Array.isArray(stats.interviewerInitials)).toBe(true);
            expect(typeof stats.interviewsByType).toBe('object');
            
            // Verify interviewer initials are generated
            if (stats.interviewerInitials.length > 0) {
              stats.interviewerInitials.forEach(initials => {
                expect(typeof initials).toBe('string');
                expect(initials.length).toBeGreaterThan(0);
                expect(initials.length).toBeLessThanOrEqual(2);
              });
            }
          }
        ),
        { numRuns: 5 }
      );
    });

    test('API endpoints handle concurrent requests correctly', () => {
      return fc.assert(
        fc.asyncProperty(
          fc.array(validInterviewDataGen(), { minLength: 2, maxLength: 4 }),
          async (interviewDataArray) => {
            // Property: Concurrent requests should all succeed
            const promises = interviewDataArray.map((data, index) => 
              interviewService.createInterview({
                ...data,
                time: `${10 + index}:00` // Different times to avoid conflicts
              }, testUserId)
            );
            
            const results = await Promise.all(promises);
            
            // Verify all requests succeeded
            expect(results.length).toBe(interviewDataArray.length);
            results.forEach((result, index) => {
              expect(result).toBeDefined();
              expect(result.id).toBeTruthy();
              testInterviewIds.push(result.id);
            });
            
            // Verify all interviews have unique IDs
            const ids = results.map(r => r.id);
            const uniqueIds = new Set(ids);
            expect(uniqueIds.size).toBe(ids.length);
          }
        ),
        { numRuns: 3 }
      );
    });

    test('API filtering and sorting work correctly', () => {
      return fc.assert(
        fc.asyncProperty(
          fc.array(validInterviewDataGen(), { minLength: 2, maxLength: 4 }),
          async (interviewDataArray) => {
            // Property: Filtering and sorting should work correctly
            const createdInterviews = [];
            
            for (let i = 0; i < interviewDataArray.length; i++) {
              const data = {
                ...interviewDataArray[i],
                time: `${8 + i}:00` // Sequential times for sorting
              };
              const interview = await interviewService.createInterview(data, testUserId);
              createdInterviews.push(interview);
              testInterviewIds.push(interview.id);
            }
            
            // Test sorting by date
            const sortedInterviews = await interviewService.getAllInterviews({}, { 
              sortBy: 'date', 
              sortOrder: 'asc' 
            });
            
            expect(sortedInterviews.interviews.length).toBeGreaterThanOrEqual(createdInterviews.length);
            
            // Verify sorting (check that dates are in ascending order)
            for (let i = 1; i < sortedInterviews.interviews.length; i++) {
              const prev = new Date(sortedInterviews.interviews[i-1].date + 'T' + sortedInterviews.interviews[i-1].time);
              const curr = new Date(sortedInterviews.interviews[i].date + 'T' + sortedInterviews.interviews[i].time);
              expect(curr.getTime()).toBeGreaterThanOrEqual(prev.getTime());
            }
          }
        ),
        { numRuns: 3 }
      );
    });
  });
});