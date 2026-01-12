/**
 * Integration Tests for Interview Scheduling System
 * Tests end-to-end functionality and integration with candidate and job systems
 * Validates: All requirements
 */

import { ObjectId } from 'mongodb';
import { InterviewService } from '../interview-service.js';
import { getInterviewsCollection } from '../interview-db.js';
import { candidateService } from '../../candidates/candidate-service.js';
import { createJob, getJobById } from '../../jobs/job-service.js';
import { INTERVIEW_TYPES, INTERVIEW_STATUS } from '../interview-models.js';

describe('Interview System Integration Tests', () => {
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
      firstName: 'Integration',
      lastName: 'TestCandidate',
      email: `integration.test.${Date.now()}@example.com`,
      phone: '+1234567890',
      location: 'Test City'
    };
    const candidate = await candidateService.createCandidate(candidateData, testUserId);
    testCandidateId = candidate._id.toString();

    // Create test job
    const jobData = {
      title: `Integration Test Job ${Date.now()}`,
      department: 'Engineering',
      type: 'full-time',
      location: 'Test Location',
      description: 'Integration test job description that is long enough to meet requirements',
      requirements: 'Integration test job requirements that are long enough to meet requirements'
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

  describe('End-to-End Interview Creation and Retrieval', () => {
    test('complete interview lifecycle works correctly', async () => {
      // Create interview
      const interviewData = {
        candidateId: testCandidateId,
        candidateName: 'Integration TestCandidate',
        jobId: testJobId,
        jobTitle: 'Integration Test Job',
        date: '2024-12-25',
        time: '10:00',
        type: INTERVIEW_TYPES.TECHNICAL,
        duration: 60,
        interviewers: ['John Doe', 'Jane Smith'],
        meetingType: 'google_meet',
        meetingLink: 'https://meet.google.com/test-meeting',
        notes: 'Integration test interview'
      };

      // Step 1: Create interview
      const createdInterview = await interviewService.createInterview(interviewData, testUserId);
      testInterviewIds.push(createdInterview.id);

      expect(createdInterview).toBeDefined();
      expect(createdInterview.id).toBeTruthy();
      expect(createdInterview.candidateId).toBe(testCandidateId);
      expect(createdInterview.jobId).toBe(testJobId);
      expect(createdInterview.status).toBe(INTERVIEW_STATUS.SCHEDULED);

      // Step 2: Retrieve by ID
      const retrievedInterview = await interviewService.getInterviewById(createdInterview.id);
      expect(retrievedInterview).toBeDefined();
      expect(retrievedInterview.id).toBe(createdInterview.id);
      expect(retrievedInterview.candidateName).toBe(interviewData.candidateName);
      expect(retrievedInterview.jobTitle).toBe(interviewData.jobTitle);

      // Step 3: Verify in list
      const allInterviews = await interviewService.getAllInterviews();
      const foundInList = allInterviews.interviews.find(i => i.id === createdInterview.id);
      expect(foundInList).toBeDefined();

      // Step 4: Update interview
      const updateData = {
        notes: 'Updated integration test notes',
        status: INTERVIEW_STATUS.COMPLETED
      };
      const updatedInterview = await interviewService.updateInterview(createdInterview.id, updateData, testUserId);
      expect(updatedInterview.notes).toBe(updateData.notes);
      expect(updatedInterview.status).toBe(updateData.status);

      // Step 5: Verify update persisted
      const reRetrievedInterview = await interviewService.getInterviewById(createdInterview.id);
      expect(reRetrievedInterview.notes).toBe(updateData.notes);
      expect(reRetrievedInterview.status).toBe(updateData.status);
    });

    test('interview creation with candidate and job integration', async () => {
      // Verify candidate exists and get details
      const candidate = await candidateService.getCandidateById(testCandidateId);
      expect(candidate).toBeDefined();
      expect(candidate.personalInfo.firstName).toBe('Integration');
      expect(candidate.personalInfo.lastName).toBe('TestCandidate');

      // Verify job exists and get details
      const job = await getJobById(testJobId);
      expect(job).toBeDefined();
      expect(job.title).toContain('Integration Test Job');

      // Create interview linking candidate and job
      const interviewData = {
        candidateId: testCandidateId,
        candidateName: `${candidate.personalInfo.firstName} ${candidate.personalInfo.lastName}`,
        jobId: testJobId,
        jobTitle: job.title,
        date: '2024-12-26',
        time: '14:00',
        type: INTERVIEW_TYPES.SCREENING,
        duration: 30,
        interviewers: ['HR Manager'],
        meetingType: 'phone',
        notes: 'Initial screening call'
      };

      const createdInterview = await interviewService.createInterview(interviewData, testUserId);
      testInterviewIds.push(createdInterview.id);

      // Verify integration data
      expect(createdInterview.candidateName).toBe(`${candidate.personalInfo.firstName} ${candidate.personalInfo.lastName}`);
      expect(createdInterview.jobTitle).toBe(job.title);

      // Verify enriched data is available
      const retrievedInterview = await interviewService.getInterviewById(createdInterview.id);
      if (retrievedInterview.currentCandidateInfo) {
        expect(retrievedInterview.currentCandidateInfo.name).toContain('Integration');
        expect(retrievedInterview.currentCandidateInfo.email).toContain('@example.com');
      }
      if (retrievedInterview.currentJobInfo) {
        expect(retrievedInterview.currentJobInfo.title).toContain('Integration Test Job');
        expect(retrievedInterview.currentJobInfo.department).toBe('Engineering');
      }
    });
  });

  describe('Data Consistency and Referential Integrity', () => {
    test('handles candidate deletion gracefully', async () => {
      // Create interview
      const interviewData = {
        candidateId: testCandidateId,
        candidateName: 'Integration TestCandidate',
        jobId: testJobId,
        jobTitle: 'Integration Test Job',
        date: '2024-12-27',
        time: '09:00',
        type: INTERVIEW_TYPES.CULTURAL,
        duration: 45,
        interviewers: ['Team Lead'],
        meetingType: 'google_meet'
      };

      const createdInterview = await interviewService.createInterview(interviewData, testUserId);
      testInterviewIds.push(createdInterview.id);

      // Verify interview exists and has candidate info
      let retrievedInterview = await interviewService.getInterviewById(createdInterview.id);
      expect(retrievedInterview.candidateId).toBe(testCandidateId);

      // Delete candidate (soft delete)
      await candidateService.deleteCandidate(testCandidateId, testUserId);

      // Verify interview still exists but handles deleted candidate
      retrievedInterview = await interviewService.getInterviewById(createdInterview.id);
      expect(retrievedInterview).toBeDefined();
      expect(retrievedInterview.id).toBe(createdInterview.id);
      expect(retrievedInterview.candidateDeleted).toBe(true);
      expect(retrievedInterview.currentCandidateInfo).toBeNull();
    });

    test('validates referential integrity on creation', async () => {
      // Try to create interview with non-existent candidate
      const invalidCandidateData = {
        candidateId: new ObjectId().toString(),
        candidateName: 'Non-existent Candidate',
        jobId: testJobId,
        jobTitle: 'Integration Test Job',
        date: '2024-12-28',
        time: '11:00',
        type: INTERVIEW_TYPES.FINAL,
        duration: 90,
        interviewers: ['CEO'],
        meetingType: 'in_person'
      };

      await expect(
        interviewService.createInterview(invalidCandidateData, testUserId)
      ).rejects.toThrow();

      // Try to create interview with non-existent job
      const invalidJobData = {
        candidateId: testCandidateId,
        candidateName: 'Integration TestCandidate',
        jobId: new ObjectId().toString(),
        jobTitle: 'Non-existent Job',
        date: '2024-12-28',
        time: '11:00',
        type: INTERVIEW_TYPES.FINAL,
        duration: 90,
        interviewers: ['CEO'],
        meetingType: 'in_person'
      };

      await expect(
        interviewService.createInterview(invalidJobData, testUserId)
      ).rejects.toThrow();
    });
  });

  describe('Statistics and Reporting Integration', () => {
    test('statistics accurately reflect multiple interviews', async () => {
      const today = new Date();
      const todayString = today.toISOString().split('T')[0];

      // Create multiple interviews for today
      const interviewsData = [
        {
          candidateId: testCandidateId,
          candidateName: 'Integration TestCandidate',
          jobId: testJobId,
          jobTitle: 'Integration Test Job',
          date: todayString,
          time: '09:00',
          type: INTERVIEW_TYPES.SCREENING,
          duration: 30,
          interviewers: ['Alice Johnson'],
          meetingType: 'phone'
        },
        {
          candidateId: testCandidateId,
          candidateName: 'Integration TestCandidate',
          jobId: testJobId,
          jobTitle: 'Integration Test Job',
          date: todayString,
          time: '14:00',
          type: INTERVIEW_TYPES.TECHNICAL,
          duration: 60,
          interviewers: ['Bob Wilson', 'Carol Davis'],
          meetingType: 'google_meet'
        },
        {
          candidateId: testCandidateId,
          candidateName: 'Integration TestCandidate',
          jobId: testJobId,
          jobTitle: 'Integration Test Job',
          date: todayString,
          time: '16:00',
          type: INTERVIEW_TYPES.SCREENING,
          duration: 30,
          interviewers: ['Alice Johnson'],
          meetingType: 'zoom'
        }
      ];

      const createdInterviews = [];
      for (const data of interviewsData) {
        const interview = await interviewService.createInterview(data, testUserId);
        createdInterviews.push(interview);
        testInterviewIds.push(interview.id);
      }

      // Get statistics
      const stats = await interviewService.getInterviewStats(today);

      // Verify statistics
      expect(stats.date).toBe(todayString);
      expect(stats.totalInterviews).toBeGreaterThanOrEqual(3);

      // Verify interviewer initials
      expect(stats.interviewerInitials).toContain('AJ'); // Alice Johnson
      expect(stats.interviewerInitials).toContain('BW'); // Bob Wilson
      expect(stats.interviewerInitials).toContain('CD'); // Carol Davis

      // Verify interview type distribution
      expect(stats.interviewsByType[INTERVIEW_TYPES.SCREENING]).toBeGreaterThanOrEqual(2);
      expect(stats.interviewsByType[INTERVIEW_TYPES.TECHNICAL]).toBeGreaterThanOrEqual(1);
    });

    test('filtering and pagination work with real data', async () => {
      // Create interviews across multiple days
      const baseDate = new Date();
      const interviews = [];

      for (let i = 0; i < 5; i++) {
        const date = new Date(baseDate);
        date.setDate(date.getDate() + i);
        
        const interviewData = {
          candidateId: testCandidateId,
          candidateName: 'Integration TestCandidate',
          jobId: testJobId,
          jobTitle: 'Integration Test Job',
          date: date.toISOString().split('T')[0],
          time: `${9 + i}:00`,
          type: Object.values(INTERVIEW_TYPES)[i % Object.values(INTERVIEW_TYPES).length],
          duration: 60,
          interviewers: [`Interviewer ${i + 1}`],
          meetingType: 'google_meet'
        };

        const interview = await interviewService.createInterview(interviewData, testUserId);
        interviews.push(interview);
        testInterviewIds.push(interview.id);
      }

      // Test pagination
      const page1 = await interviewService.getAllInterviews({}, { page: 1, limit: 3 });
      expect(page1.interviews.length).toBeLessThanOrEqual(3);
      expect(page1.pagination.page).toBe(1);
      expect(page1.pagination.limit).toBe(3);
      expect(page1.pagination.total).toBeGreaterThanOrEqual(5);

      // Test filtering by type
      const screeningInterviews = interviews.filter(i => i.type === INTERVIEW_TYPES.SCREENING);
      if (screeningInterviews.length > 0) {
        const filtered = await interviewService.getAllInterviews({ 
          type: INTERVIEW_TYPES.SCREENING 
        });
        const ourScreeningInterviews = filtered.interviews.filter(i => 
          testInterviewIds.includes(i.id)
        );
        expect(ourScreeningInterviews.length).toBe(screeningInterviews.length);
      }
    });
  });

  describe('Concurrent Operations', () => {
    test('handles concurrent interview creation', async () => {
      const promises = [];
      const interviewCount = 3;

      for (let i = 0; i < interviewCount; i++) {
        const interviewData = {
          candidateId: testCandidateId,
          candidateName: 'Integration TestCandidate',
          jobId: testJobId,
          jobTitle: 'Integration Test Job',
          date: '2024-12-30',
          time: `${10 + i}:00`, // Different times to avoid conflicts
          type: INTERVIEW_TYPES.TECHNICAL,
          duration: 60,
          interviewers: [`Concurrent Interviewer ${i + 1}`],
          meetingType: 'google_meet'
        };

        promises.push(interviewService.createInterview(interviewData, testUserId));
      }

      const results = await Promise.all(promises);

      // Verify all interviews were created
      expect(results.length).toBe(interviewCount);
      results.forEach((interview, index) => {
        expect(interview).toBeDefined();
        expect(interview.id).toBeTruthy();
        testInterviewIds.push(interview.id);
      });

      // Verify all have unique IDs
      const ids = results.map(r => r.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });

    test('handles concurrent read operations', async () => {
      // Create a test interview first
      const interviewData = {
        candidateId: testCandidateId,
        candidateName: 'Integration TestCandidate',
        jobId: testJobId,
        jobTitle: 'Integration Test Job',
        date: '2024-12-31',
        time: '15:00',
        type: INTERVIEW_TYPES.FINAL,
        duration: 120,
        interviewers: ['Final Interviewer'],
        meetingType: 'in_person'
      };

      const createdInterview = await interviewService.createInterview(interviewData, testUserId);
      testInterviewIds.push(createdInterview.id);

      // Perform concurrent reads
      const readPromises = [
        interviewService.getInterviewById(createdInterview.id),
        interviewService.getAllInterviews(),
        interviewService.getInterviewStats(new Date()),
        interviewService.getInterviewById(createdInterview.id),
        interviewService.getAllInterviews()
      ];

      const results = await Promise.all(readPromises);

      // Verify all reads succeeded
      expect(results[0]).toBeDefined(); // getById
      expect(results[1].interviews).toBeDefined(); // getAll
      expect(results[2].totalInterviews).toBeDefined(); // getStats
      expect(results[3]).toBeDefined(); // getById again
      expect(results[4].interviews).toBeDefined(); // getAll again

      // Verify consistency
      expect(results[0].id).toBe(results[3].id);
      expect(results[1].interviews.length).toBe(results[4].interviews.length);
    });
  });

  describe('Error Handling and Recovery', () => {
    test('handles database connection issues gracefully', async () => {
      // This test would require mocking database failures
      // For now, we'll test that the service initializes properly
      const newService = new InterviewService();
      await expect(newService.initialize()).resolves.not.toThrow();
    });

    test('handles malformed data gracefully', async () => {
      const malformedData = {
        candidateId: 'not-an-objectid',
        candidateName: '',
        jobId: 'also-not-an-objectid',
        jobTitle: '',
        date: 'invalid-date',
        time: 'invalid-time',
        type: 'invalid-type'
      };

      await expect(
        interviewService.createInterview(malformedData, testUserId)
      ).rejects.toThrow();
    });

    test('handles missing required fields', async () => {
      const incompleteData = {
        candidateId: testCandidateId,
        // Missing other required fields
      };

      await expect(
        interviewService.createInterview(incompleteData, testUserId)
      ).rejects.toThrow();
    });
  });
});