/**
 * Property-Based Tests for Interview Data Retrieval and Display
 * Feature: interview-scheduling, Property 6: Interview Retrieval and Sorting
 * Feature: interview-scheduling, Property 7: Date Formatting Consistency
 * Feature: interview-scheduling, Property 8: Daily Statistics Calculation
 * Validates: Requirements 3.1, 3.2, 3.3, 3.4, 4.1, 4.2, 4.3
 */

import fc from 'fast-check';
import { ObjectId } from 'mongodb';
import { InterviewService } from '../interview-service.js';
import { 
  formatInterviewForDisplay, 
  generateInterviewerInitials, 
  isInterviewToday,
  getInterviewsForDate,
  INTERVIEW_TYPES, 
  INTERVIEW_STATUS 
} from '../interview-models.js';
import { getInterviewsCollection } from '../interview-db.js';
import { candidateService } from '../../candidates/candidate-service.js';
import { createJob } from '../../jobs/job-service.js';

// Helper generators
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

const validInterviewerNamesGen = () => fc.array(
  fc.string({ minLength: 1, maxLength: 50 }).filter(s => s.trim().length > 0),
  { minLength: 1, maxLength: 5 }
);

describe('Interview Display Property Tests', () => {
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
    meetingType: fc.constantFrom('google_meet', 'zoom', 'phone', 'in_person'),
    meetingLink: fc.option(fc.webUrl()),
    location: fc.option(fc.string({ minLength: 1, maxLength: 200 })),
    notes: fc.option(fc.string({ maxLength: 500 }))
  });

  /**
   * Property 6: Interview Retrieval and Sorting
   * For any collection of interviews retrieved from the system, the interviews 
   * should be returned in the requested sort order (by date, time, or other fields) 
   * and maintain consistent data structure across all retrieval operations.
   */
  describe('Property 6: Interview Retrieval and Sorting', () => {
    
    test('retrieved interviews maintain consistent sort order by date', () => {
      return fc.assert(
        fc.asyncProperty(
          fc.array(validInterviewDataGen(), { minLength: 3, maxLength: 5 }),
          async (interviewDataArray) => {
            // Property: Retrieved interviews should maintain sort order
            const createdInterviews = [];
            
            // Create interviews with different dates
            for (let i = 0; i < interviewDataArray.length; i++) {
              const baseDate = new Date();
              baseDate.setDate(baseDate.getDate() + i + 1);
              const data = {
                ...interviewDataArray[i],
                date: baseDate.toISOString().split('T')[0],
                time: '10:00'
              };
              const interview = await interviewService.createInterview(data, testUserId);
              createdInterviews.push(interview);
              testInterviewIds.push(interview.id);
            }
            
            // Test ascending sort
            const ascendingResult = await interviewService.getAllInterviews({}, { 
              sortBy: 'date', 
              sortOrder: 'asc' 
            });
            
            // Verify ascending order
            const ascendingInterviews = ascendingResult.interviews.filter(interview => 
              testInterviewIds.includes(interview.id)
            );
            
            for (let i = 1; i < ascendingInterviews.length; i++) {
              const prevDate = new Date(ascendingInterviews[i-1].date);
              const currDate = new Date(ascendingInterviews[i].date);
              expect(currDate.getTime()).toBeGreaterThanOrEqual(prevDate.getTime());
            }
            
            // Verify all created interviews are present
            expect(ascendingInterviews.length).toBe(createdInterviews.length);
          }
        ),
        { numRuns: 5 }
      );
    });

    test('interview retrieval maintains data structure consistency', () => {
      return fc.assert(
        fc.asyncProperty(
          validInterviewDataGen(),
          async (interviewData) => {
            // Property: Retrieved interviews should have consistent structure
            const createdInterview = await interviewService.createInterview(interviewData, testUserId);
            testInterviewIds.push(createdInterview.id);
            
            // Test single retrieval
            const singleRetrieved = await interviewService.getInterviewById(createdInterview.id);
            
            // Test bulk retrieval
            const bulkRetrieved = await interviewService.getAllInterviews();
            const foundInBulk = bulkRetrieved.interviews.find(i => i.id === createdInterview.id);
            
            // Verify structure consistency
            const requiredFields = [
              'id', 'candidateId', 'jobId', 'candidateName', 'jobTitle',
              'date', 'time', 'type', 'duration', 'interviewers', 'status',
              'meetingDetails', 'createdAt', 'updatedAt'
            ];
            
            requiredFields.forEach(field => {
              expect(singleRetrieved).toHaveProperty(field);
              expect(foundInBulk).toHaveProperty(field);
              expect(singleRetrieved[field]).toEqual(foundInBulk[field]);
            });
          }
        ),
        { numRuns: 10 }
      );
    });

    test('pagination works correctly with sorted results', () => {
      return fc.assert(
        fc.asyncProperty(
          fc.array(validInterviewDataGen(), { minLength: 5, maxLength: 8 }),
          async (interviewDataArray) => {
            // Property: Pagination should work correctly with sorting
            const createdInterviews = [];
            
            for (let i = 0; i < interviewDataArray.length; i++) {
              const data = {
                ...interviewDataArray[i],
                time: `${8 + i}:00` // Sequential times for predictable sorting
              };
              const interview = await interviewService.createInterview(data, testUserId);
              createdInterviews.push(interview);
              testInterviewIds.push(interview.id);
            }
            
            // Test pagination
            const pageSize = 3;
            const firstPage = await interviewService.getAllInterviews({}, { 
              page: 1, 
              limit: pageSize 
            });
            
            expect(firstPage.pagination).toBeDefined();
            expect(firstPage.pagination.page).toBe(1);
            expect(firstPage.pagination.limit).toBe(pageSize);
            expect(firstPage.pagination.total).toBeGreaterThanOrEqual(createdInterviews.length);
            expect(firstPage.interviews.length).toBeLessThanOrEqual(pageSize);
          }
        ),
        { numRuns: 3 }
      );
    });
  });

  /**
   * Property 7: Date Formatting Consistency
   * For any interview date and time data, the system should consistently format 
   * dates and times for display across all components, maintaining the same 
   * format patterns regardless of input variations or timezone considerations.
   */
  describe('Property 7: Date Formatting Consistency', () => {
    
    test('date formatting is consistent across all display functions', () => {
      return fc.assert(
        fc.asyncProperty(
          validInterviewDataGen(),
          async (interviewData) => {
            // Property: Date formatting should be consistent
            const createdInterview = await interviewService.createInterview(interviewData, testUserId);
            testInterviewIds.push(createdInterview.id);
            
            // Get the stored document directly
            const collection = await getInterviewsCollection();
            const storedDoc = await collection.findOne({ _id: new ObjectId(createdInterview.id) });
            
            // Format using the display function
            const formattedInterview = formatInterviewForDisplay(storedDoc);
            
            // Verify date format consistency (YYYY-MM-DD)
            expect(formattedInterview.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
            expect(formattedInterview.date).toBe(interviewData.date);
            
            // Verify time format consistency (HH:MM)
            expect(formattedInterview.time).toMatch(/^\d{2}:\d{2}$/);
            expect(formattedInterview.time).toBe(interviewData.time);
            
            // Verify the formatted date matches the original input
            const originalDate = new Date(interviewData.date + 'T' + interviewData.time);
            const formattedDate = new Date(formattedInterview.date + 'T' + formattedInterview.time);
            expect(formattedDate.getTime()).toBe(originalDate.getTime());
          }
        ),
        { numRuns: 10 }
      );
    });

    test('date formatting handles edge cases consistently', () => {
      return fc.assert(
        fc.asyncProperty(
          fc.record({
            ...validInterviewDataGen().constraints,
            date: fc.constantFrom(
              '2024-01-01', '2024-12-31', '2024-02-29', // Edge dates
              '2025-06-15', '2025-11-30'
            ),
            time: fc.constantFrom(
              '00:00', '23:59', '12:00', '09:30', '17:45' // Edge times
            )
          }),
          async (interviewData) => {
            // Property: Edge case dates should format consistently
            const createdInterview = await interviewService.createInterview(interviewData, testUserId);
            testInterviewIds.push(createdInterview.id);
            
            const retrievedInterview = await interviewService.getInterviewById(createdInterview.id);
            
            // Verify edge cases maintain format
            expect(retrievedInterview.date).toBe(interviewData.date);
            expect(retrievedInterview.time).toBe(interviewData.time);
            
            // Verify date parsing works correctly
            const parsedDate = new Date(retrievedInterview.date + 'T' + retrievedInterview.time);
            expect(isNaN(parsedDate.getTime())).toBe(false);
          }
        ),
        { numRuns: 10 }
      );
    });

    test('duration formatting is consistent', () => {
      return fc.assert(
        fc.asyncProperty(
          fc.record({
            ...validInterviewDataGen().constraints,
            duration: fc.integer({ min: 15, max: 480 }).filter(d => d % 15 === 0)
          }),
          async (interviewData) => {
            // Property: Duration formatting should be consistent
            const createdInterview = await interviewService.createInterview(interviewData, testUserId);
            testInterviewIds.push(createdInterview.id);
            
            const retrievedInterview = await interviewService.getInterviewById(createdInterview.id);
            
            // Verify duration format includes "minutes"
            expect(retrievedInterview.duration).toMatch(/^\d+ minutes$/);
            
            // Extract numeric value and verify it matches input
            const durationValue = parseInt(retrievedInterview.duration.split(' ')[0]);
            expect(durationValue).toBe(interviewData.duration);
          }
        ),
        { numRuns: 10 }
      );
    });
  });

  /**
   * Property 8: Daily Statistics Calculation
   * For any given date, the system should accurately calculate and return 
   * statistics including total interview count, interviewer initials, and 
   * interview type distribution for that specific date.
   */
  describe('Property 8: Daily Statistics Calculation', () => {
    
    test('daily statistics accurately reflect scheduled interviews', () => {
      return fc.assert(
        fc.asyncProperty(
          fc.array(validInterviewDataGen(), { minLength: 2, maxLength: 4 }),
          async (interviewDataArray) => {
            // Property: Statistics should accurately reflect scheduled interviews
            const today = new Date();
            const todayString = today.toISOString().split('T')[0];
            
            const createdInterviews = [];
            for (let i = 0; i < interviewDataArray.length; i++) {
              const data = {
                ...interviewDataArray[i],
                date: todayString, // All for today
                time: `${9 + i}:00` // Different times
              };
              const interview = await interviewService.createInterview(data, testUserId);
              createdInterviews.push(interview);
              testInterviewIds.push(interview.id);
            }
            
            const stats = await interviewService.getInterviewStats(today);
            
            // Verify basic statistics
            expect(stats.date).toBe(todayString);
            expect(stats.totalInterviews).toBeGreaterThanOrEqual(createdInterviews.length);
            
            // Verify interviewer initials generation
            expect(Array.isArray(stats.interviewerInitials)).toBe(true);
            if (stats.interviewerInitials.length > 0) {
              stats.interviewerInitials.forEach(initials => {
                expect(typeof initials).toBe('string');
                expect(initials.length).toBeGreaterThan(0);
                expect(initials.length).toBeLessThanOrEqual(2);
                expect(initials).toMatch(/^[A-Z]+$/); // Should be uppercase letters
              });
            }
            
            // Verify interview type distribution
            expect(typeof stats.interviewsByType).toBe('object');
            Object.keys(stats.interviewsByType).forEach(type => {
              expect(Object.values(INTERVIEW_TYPES)).toContain(type);
              expect(typeof stats.interviewsByType[type]).toBe('number');
              expect(stats.interviewsByType[type]).toBeGreaterThan(0);
            });
          }
        ),
        { numRuns: 5 }
      );
    });

    test('interviewer initials generation works correctly', () => {
      return fc.assert(
        fc.asyncProperty(
          validInterviewerNamesGen(),
          (interviewerNames) => {
            // Property: Interviewer initials should be generated correctly
            const initials = generateInterviewerInitials(interviewerNames);
            
            expect(Array.isArray(initials)).toBe(true);
            expect(initials.length).toBe(interviewerNames.length);
            
            initials.forEach((initial, index) => {
              const name = interviewerNames[index];
              const nameParts = name.trim().split(' ').filter(Boolean);
              
              if (nameParts.length === 1) {
                expect(initial).toBe(nameParts[0].charAt(0).toUpperCase());
              } else if (nameParts.length >= 2) {
                const expectedInitial = (nameParts[0].charAt(0) + nameParts[nameParts.length - 1].charAt(0)).toUpperCase();
                expect(initial).toBe(expectedInitial);
              }
            });
          }
        ),
        { numRuns: 20 }
      );
    });

    test('statistics handle empty days correctly', () => {
      return fc.assert(
        fc.asyncProperty(
          fc.date({ min: new Date('2030-01-01'), max: new Date('2030-12-31') }),
          async (futureDate) => {
            // Property: Empty days should return zero statistics
            const stats = await interviewService.getInterviewStats(futureDate);
            
            expect(stats.date).toBe(futureDate.toISOString().split('T')[0]);
            expect(stats.totalInterviews).toBe(0);
            expect(Array.isArray(stats.interviewerInitials)).toBe(true);
            expect(stats.interviewerInitials.length).toBe(0);
            expect(typeof stats.interviewsByType).toBe('object');
            expect(Object.keys(stats.interviewsByType).length).toBe(0);
          }
        ),
        { numRuns: 5 }
      );
    });

    test('date filtering works correctly for statistics', () => {
      return fc.assert(
        fc.asyncProperty(
          fc.array(validInterviewDataGen(), { minLength: 3, maxLength: 5 }),
          async (interviewDataArray) => {
            // Property: Date filtering should work correctly
            const targetDate = new Date();
            targetDate.setDate(targetDate.getDate() + 5); // 5 days from now
            const targetDateString = targetDate.toISOString().split('T')[0];
            
            const otherDate = new Date();
            otherDate.setDate(otherDate.getDate() + 10); // 10 days from now
            const otherDateString = otherDate.toISOString().split('T')[0];
            
            // Create interviews for target date
            const targetInterviews = [];
            for (let i = 0; i < Math.floor(interviewDataArray.length / 2); i++) {
              const data = {
                ...interviewDataArray[i],
                date: targetDateString,
                time: `${9 + i}:00`
              };
              const interview = await interviewService.createInterview(data, testUserId);
              targetInterviews.push(interview);
              testInterviewIds.push(interview.id);
            }
            
            // Create interviews for other date
            for (let i = Math.floor(interviewDataArray.length / 2); i < interviewDataArray.length; i++) {
              const data = {
                ...interviewDataArray[i],
                date: otherDateString,
                time: `${9 + i}:00`
              };
              const interview = await interviewService.createInterview(data, testUserId);
              testInterviewIds.push(interview.id);
            }
            
            // Get statistics for target date
            const targetStats = await interviewService.getInterviewStats(targetDate);
            
            // Verify only target date interviews are counted
            expect(targetStats.date).toBe(targetDateString);
            expect(targetStats.totalInterviews).toBeGreaterThanOrEqual(targetInterviews.length);
            
            // Get statistics for other date
            const otherStats = await interviewService.getInterviewStats(otherDate);
            expect(otherStats.date).toBe(otherDateString);
            
            // Verify dates are filtered correctly
            expect(targetStats.totalInterviews).not.toBe(otherStats.totalInterviews);
          }
        ),
        { numRuns: 3 }
      );
    });
  });
});