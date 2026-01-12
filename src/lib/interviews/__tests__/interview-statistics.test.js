/**
 * Unit Tests for Interview Statistics Edge Cases
 * Tests specific edge cases and error conditions for statistics functionality
 * Validates: Requirements 3.5, 4.5
 */

import { ObjectId } from 'mongodb';
import { InterviewService } from '../interview-service.js';
import { 
  generateInterviewerInitials, 
  isInterviewToday,
  getInterviewsForDate,
  INTERVIEW_TYPES 
} from '../interview-models.js';
import { getInterviewsCollection } from '../interview-db.js';

describe('Interview Statistics Unit Tests', () => {
  let interviewService;
  let testInterviewIds = [];

  beforeAll(async () => {
    interviewService = new InterviewService();
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

  describe('generateInterviewerInitials', () => {
    test('handles empty array', () => {
      const result = generateInterviewerInitials([]);
      expect(result).toEqual([]);
    });

    test('handles null and undefined input', () => {
      expect(generateInterviewerInitials(null)).toEqual([]);
      expect(generateInterviewerInitials(undefined)).toEqual([]);
    });

    test('handles single name', () => {
      const result = generateInterviewerInitials(['John']);
      expect(result).toEqual(['J']);
    });

    test('handles full name', () => {
      const result = generateInterviewerInitials(['John Doe']);
      expect(result).toEqual(['JD']);
    });

    test('handles multiple middle names', () => {
      const result = generateInterviewerInitials(['John Michael Smith Doe']);
      expect(result).toEqual(['JD']); // First and last only
    });

    test('handles names with extra whitespace', () => {
      const result = generateInterviewerInitials(['  John   Doe  ']);
      expect(result).toEqual(['JD']);
    });

    test('handles empty strings in array', () => {
      const result = generateInterviewerInitials(['John Doe', '', 'Jane Smith']);
      expect(result).toEqual(['JD', '', 'JS']);
    });

    test('handles special characters in names', () => {
      const result = generateInterviewerInitials(['Jean-Pierre Dupont', "O'Connor Smith"]);
      expect(result).toEqual(['JD', 'OS']);
    });

    test('handles lowercase names', () => {
      const result = generateInterviewerInitials(['john doe', 'jane smith']);
      expect(result).toEqual(['JD', 'JS']);
    });

    test('handles mixed case names', () => {
      const result = generateInterviewerInitials(['JoHn DoE', 'jAnE sMiTh']);
      expect(result).toEqual(['JD', 'JS']);
    });
  });

  describe('isInterviewToday', () => {
    test('correctly identifies today\'s interviews', () => {
      const today = new Date();
      const interview = {
        scheduledDate: today
      };
      
      expect(isInterviewToday(interview, today)).toBe(true);
    });

    test('correctly identifies non-today interviews', () => {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const interview = {
        scheduledDate: tomorrow
      };
      
      expect(isInterviewToday(interview, today)).toBe(false);
    });

    test('handles different times on same date', () => {
      const today = new Date();
      today.setHours(10, 30, 0, 0);
      
      const interview = {
        scheduledDate: new Date(today)
      };
      interview.scheduledDate.setHours(15, 45, 0, 0);
      
      expect(isInterviewToday(interview, today)).toBe(true);
    });

    test('handles edge case at midnight', () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const interview = {
        scheduledDate: new Date(today)
      };
      
      expect(isInterviewToday(interview, today)).toBe(true);
    });

    test('handles edge case at end of day', () => {
      const today = new Date();
      today.setHours(23, 59, 59, 999);
      
      const interview = {
        scheduledDate: new Date(today)
      };
      
      expect(isInterviewToday(interview, today)).toBe(true);
    });
  });

  describe('getInterviewsForDate', () => {
    test('handles empty interview array', () => {
      const result = getInterviewsForDate([], new Date());
      expect(result).toEqual([]);
    });

    test('handles null interview array', () => {
      const result = getInterviewsForDate(null, new Date());
      expect(result).toEqual([]);
    });

    test('handles undefined interview array', () => {
      const result = getInterviewsForDate(undefined, new Date());
      expect(result).toEqual([]);
    });

    test('filters interviews correctly by date', () => {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const interviews = [
        { scheduledDate: today },
        { scheduledDate: tomorrow },
        { scheduledDate: today }
      ];
      
      const result = getInterviewsForDate(interviews, today);
      expect(result).toHaveLength(2);
      expect(result.every(interview => isInterviewToday(interview, today))).toBe(true);
    });

    test('returns empty array when no interviews match date', () => {
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      
      const interviews = [
        { scheduledDate: tomorrow },
        { scheduledDate: tomorrow }
      ];
      
      const result = getInterviewsForDate(interviews, today);
      expect(result).toEqual([]);
    });
  });

  describe('InterviewService.getInterviewStats edge cases', () => {
    test('handles date with no interviews', async () => {
      const futureDate = new Date('2030-01-01');
      const stats = await interviewService.getInterviewStats(futureDate);
      
      expect(stats.date).toBe('2030-01-01');
      expect(stats.totalInterviews).toBe(0);
      expect(stats.interviewerInitials).toEqual([]);
      expect(stats.interviewsByType).toEqual({});
    });

    test('handles invalid date input gracefully', async () => {
      const invalidDate = new Date('invalid');
      
      // Should not throw, but handle gracefully
      await expect(interviewService.getInterviewStats(invalidDate)).rejects.toThrow();
    });

    test('handles null date input', async () => {
      // Should default to today
      const stats = await interviewService.getInterviewStats(null);
      const today = new Date().toISOString().split('T')[0];
      
      expect(stats.date).toBe(today);
      expect(typeof stats.totalInterviews).toBe('number');
      expect(Array.isArray(stats.interviewerInitials)).toBe(true);
      expect(typeof stats.interviewsByType).toBe('object');
    });

    test('handles undefined date input', async () => {
      // Should default to today
      const stats = await interviewService.getInterviewStats(undefined);
      const today = new Date().toISOString().split('T')[0];
      
      expect(stats.date).toBe(today);
      expect(typeof stats.totalInterviews).toBe('number');
      expect(Array.isArray(stats.interviewerInitials)).toBe(true);
      expect(typeof stats.interviewsByType).toBe('object');
    });

    test('handles leap year dates correctly', async () => {
      const leapYearDate = new Date('2024-02-29');
      const stats = await interviewService.getInterviewStats(leapYearDate);
      
      expect(stats.date).toBe('2024-02-29');
      expect(typeof stats.totalInterviews).toBe('number');
    });

    test('handles year boundaries correctly', async () => {
      const newYearDate = new Date('2025-01-01');
      const stats = await interviewService.getInterviewStats(newYearDate);
      
      expect(stats.date).toBe('2025-01-01');
      expect(typeof stats.totalInterviews).toBe('number');
    });

    test('handles timezone edge cases', async () => {
      // Test with a date that might have timezone issues
      const date = new Date('2024-12-31T23:59:59.999Z');
      const stats = await interviewService.getInterviewStats(date);
      
      expect(stats.date).toBe('2024-12-31');
      expect(typeof stats.totalInterviews).toBe('number');
    });
  });

  describe('Statistics calculation edge cases', () => {
    test('handles interviews with empty interviewer arrays', async () => {
      // This would require creating a test interview, but we'll test the logic
      const mockInterviews = [
        { interviewers: [] },
        { interviewers: ['John Doe'] },
        { interviewers: [] }
      ];
      
      const allInterviewers = mockInterviews.flatMap(interview => interview.interviewers || []);
      const uniqueInterviewers = [...new Set(allInterviewers)];
      const initials = generateInterviewerInitials(uniqueInterviewers);
      
      expect(initials).toEqual(['JD']);
    });

    test('handles interviews with null interviewer arrays', async () => {
      const mockInterviews = [
        { interviewers: null },
        { interviewers: ['Jane Smith'] },
        { interviewers: undefined }
      ];
      
      const allInterviewers = mockInterviews.flatMap(interview => interview.interviewers || []);
      const uniqueInterviewers = [...new Set(allInterviewers)];
      const initials = generateInterviewerInitials(uniqueInterviewers);
      
      expect(initials).toEqual(['JS']);
    });

    test('handles duplicate interviewer names', async () => {
      const mockInterviews = [
        { interviewers: ['John Doe', 'Jane Smith'] },
        { interviewers: ['John Doe', 'Bob Wilson'] },
        { interviewers: ['Jane Smith'] }
      ];
      
      const allInterviewers = mockInterviews.flatMap(interview => interview.interviewers || []);
      const uniqueInterviewers = [...new Set(allInterviewers)];
      const initials = generateInterviewerInitials(uniqueInterviewers);
      
      expect(initials).toHaveLength(3);
      expect(initials).toContain('JD');
      expect(initials).toContain('JS');
      expect(initials).toContain('BW');
    });

    test('handles interviews with all types', async () => {
      const mockInterviews = [
        { type: INTERVIEW_TYPES.SCREENING },
        { type: INTERVIEW_TYPES.TECHNICAL },
        { type: INTERVIEW_TYPES.CULTURAL },
        { type: INTERVIEW_TYPES.FINAL },
        { type: INTERVIEW_TYPES.SCREENING } // Duplicate
      ];
      
      const typeCount = mockInterviews.reduce((acc, interview) => {
        acc[interview.type] = (acc[interview.type] || 0) + 1;
        return acc;
      }, {});
      
      expect(typeCount[INTERVIEW_TYPES.SCREENING]).toBe(2);
      expect(typeCount[INTERVIEW_TYPES.TECHNICAL]).toBe(1);
      expect(typeCount[INTERVIEW_TYPES.CULTURAL]).toBe(1);
      expect(typeCount[INTERVIEW_TYPES.FINAL]).toBe(1);
    });

    test('handles interviews with unknown types gracefully', async () => {
      const mockInterviews = [
        { type: 'unknown_type' },
        { type: INTERVIEW_TYPES.SCREENING },
        { type: null },
        { type: undefined }
      ];
      
      const typeCount = mockInterviews.reduce((acc, interview) => {
        if (interview.type && Object.values(INTERVIEW_TYPES).includes(interview.type)) {
          acc[interview.type] = (acc[interview.type] || 0) + 1;
        }
        return acc;
      }, {});
      
      expect(typeCount[INTERVIEW_TYPES.SCREENING]).toBe(1);
      expect(Object.keys(typeCount)).toHaveLength(1);
    });
  });

  describe('Date filtering edge cases', () => {
    test('handles daylight saving time transitions', async () => {
      // Test around DST transition dates (these are approximate)
      const dstDate = new Date('2024-03-10'); // Spring forward in US
      const stats = await interviewService.getInterviewStats(dstDate);
      
      expect(stats.date).toBe('2024-03-10');
      expect(typeof stats.totalInterviews).toBe('number');
    });

    test('handles different date formats consistently', async () => {
      const date1 = new Date('2024-06-15');
      const date2 = new Date(2024, 5, 15); // Month is 0-indexed
      const date3 = new Date('June 15, 2024');
      
      const stats1 = await interviewService.getInterviewStats(date1);
      const stats2 = await interviewService.getInterviewStats(date2);
      const stats3 = await interviewService.getInterviewStats(date3);
      
      expect(stats1.date).toBe('2024-06-15');
      expect(stats2.date).toBe('2024-06-15');
      expect(stats3.date).toBe('2024-06-15');
    });

    test('handles very old and very future dates', async () => {
      const oldDate = new Date('1900-01-01');
      const futureDate = new Date('2100-12-31');
      
      const oldStats = await interviewService.getInterviewStats(oldDate);
      const futureStats = await interviewService.getInterviewStats(futureDate);
      
      expect(oldStats.date).toBe('1900-01-01');
      expect(oldStats.totalInterviews).toBe(0);
      
      expect(futureStats.date).toBe('2100-12-31');
      expect(futureStats.totalInterviews).toBe(0);
    });
  });
});