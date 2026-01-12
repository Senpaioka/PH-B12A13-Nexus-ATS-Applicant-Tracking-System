/**
 * Interview Data Models and Schema Definitions
 * Defines the structure and validation for interview records
 */

import { ObjectId } from 'mongodb';

/**
 * Interview types enum
 */
export const INTERVIEW_TYPES = {
  SCREENING: 'screening',
  TECHNICAL: 'technical',
  CULTURAL: 'cultural',
  FINAL: 'final'
};

/**
 * Interview status enum
 */
export const INTERVIEW_STATUS = {
  SCHEDULED: 'scheduled',
  COMPLETED: 'completed',
  CANCELLED: 'cancelled',
  RESCHEDULED: 'rescheduled'
};

/**
 * Meeting types enum
 */
export const MEETING_TYPES = {
  VIDEO: 'video',
  PHONE: 'phone',
  IN_PERSON: 'in-person'
};

/**
 * Default duration for different interview types (in minutes)
 */
export const DEFAULT_DURATIONS = {
  [INTERVIEW_TYPES.SCREENING]: 30,
  [INTERVIEW_TYPES.TECHNICAL]: 60,
  [INTERVIEW_TYPES.CULTURAL]: 45,
  [INTERVIEW_TYPES.FINAL]: 90
};

/**
 * Creates a new interview document structure
 * @param {Object} interviewData - Raw interview data
 * @returns {Object} Formatted interview document
 */
export function createInterviewDocument(interviewData) {
  const now = new Date();
  
  // Combine date and time into a single Date object
  const scheduledDate = combineDateTime(interviewData.date, interviewData.time);
  
  return {
    candidateId: interviewData.candidateId && ObjectId.isValid(interviewData.candidateId) 
      ? new ObjectId(interviewData.candidateId) 
      : null,
    candidateName: interviewData.candidateName?.trim(),
    jobId: interviewData.jobId && ObjectId.isValid(interviewData.jobId) 
      ? new ObjectId(interviewData.jobId) 
      : null,
    jobTitle: interviewData.jobTitle?.trim(),
    scheduledDate: scheduledDate,
    duration: interviewData.duration || DEFAULT_DURATIONS[interviewData.type] || 60,
    type: interviewData.type || INTERVIEW_TYPES.SCREENING,
    interviewers: Array.isArray(interviewData.interviewers) 
      ? interviewData.interviewers.map(name => name.trim()).filter(Boolean)
      : [],
    meetingDetails: {
      type: interviewData.meetingType || MEETING_TYPES.VIDEO,
      link: interviewData.meetingLink?.trim() || null,
      location: interviewData.location?.trim() || null
    },
    notes: interviewData.notes?.trim() || '',
    status: interviewData.status || INTERVIEW_STATUS.SCHEDULED,
    metadata: {
      createdAt: now,
      updatedAt: now,
      createdBy: interviewData.createdBy && ObjectId.isValid(interviewData.createdBy) 
        ? new ObjectId(interviewData.createdBy) 
        : null,
      isActive: true
    }
  };
}

/**
 * Combines date and time strings into a single Date object
 * @param {string} dateString - Date in YYYY-MM-DD format
 * @param {string} timeString - Time in HH:MM format
 * @returns {Date} Combined date and time
 */
export function combineDateTime(dateString, timeString) {
  if (!dateString || !timeString) {
    throw new Error('Both date and time are required');
  }
  
  const [hours, minutes] = timeString.split(':').map(Number);
  const date = new Date(dateString);
  
  if (isNaN(date.getTime())) {
    throw new Error('Invalid date format');
  }
  
  if (isNaN(hours) || isNaN(minutes) || hours < 0 || hours > 23 || minutes < 0 || minutes > 59) {
    throw new Error('Invalid time format');
  }
  
  date.setHours(hours, minutes, 0, 0);
  return date;
}

/**
 * Validates interview type
 * @param {string} type - Interview type to validate
 * @returns {boolean} True if valid
 */
export function validateInterviewType(type) {
  return Object.values(INTERVIEW_TYPES).includes(type);
}

/**
 * Validates interview status
 * @param {string} status - Interview status to validate
 * @returns {boolean} True if valid
 */
export function validateInterviewStatus(status) {
  return Object.values(INTERVIEW_STATUS).includes(status);
}

/**
 * Validates meeting type
 * @param {string} meetingType - Meeting type to validate
 * @returns {boolean} True if valid
 */
export function validateMeetingType(meetingType) {
  return Object.values(MEETING_TYPES).includes(meetingType);
}

/**
 * Formats interview for display
 * @param {Object} interview - Interview document
 * @returns {Object} Formatted interview for UI display
 */
export function formatInterviewForDisplay(interview) {
  if (!interview) return null;
  
  const scheduledDate = new Date(interview.scheduledDate);
  
  return {
    id: interview._id.toString(),
    candidateId: interview.candidateId?.toString(),
    candidateName: interview.candidateName,
    jobId: interview.jobId?.toString(),
    jobTitle: interview.jobTitle,
    date: scheduledDate.toISOString().split('T')[0], // YYYY-MM-DD
    time: scheduledDate.toTimeString().slice(0, 5), // HH:MM
    duration: `${interview.duration} minutes`,
    type: interview.type,
    interviewers: interview.interviewers,
    meetingDetails: interview.meetingDetails,
    notes: interview.notes,
    status: interview.status,
    createdAt: interview.metadata.createdAt,
    updatedAt: interview.metadata.updatedAt
  };
}

/**
 * Generates interviewer initials from names
 * @param {Array<string>} interviewers - Array of interviewer names
 * @returns {Array<string>} Array of initials
 */
export function generateInterviewerInitials(interviewers) {
  if (!Array.isArray(interviewers)) return [];
  
  return interviewers.map(name => {
    const parts = name.trim().split(' ').filter(Boolean);
    if (parts.length === 0) return '';
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  });
}

/**
 * Checks if an interview is scheduled for today
 * @param {Object} interview - Interview document
 * @param {Date} referenceDate - Date to compare against (defaults to today)
 * @returns {boolean} True if interview is today
 */
export function isInterviewToday(interview, referenceDate = new Date()) {
  const interviewDate = new Date(interview.scheduledDate);
  const today = new Date(referenceDate);
  
  return interviewDate.toDateString() === today.toDateString();
}

/**
 * Gets interviews scheduled for a specific date
 * @param {Array<Object>} interviews - Array of interview documents
 * @param {Date} targetDate - Date to filter by
 * @returns {Array<Object>} Filtered interviews
 */
export function getInterviewsForDate(interviews, targetDate = new Date()) {
  if (!Array.isArray(interviews)) return [];
  
  return interviews.filter(interview => isInterviewToday(interview, targetDate));
}

/**
 * MongoDB indexes for optimal query performance
 */
export const INTERVIEW_INDEXES = [
  // Compound index for efficient date-based queries
  { 
    key: { scheduledDate: 1, status: 1 } 
  },
  // Index for candidate-based queries
  { 
    key: { candidateId: 1, status: 1 } 
  },
  // Index for job-based queries
  { 
    key: { jobId: 1, status: 1 } 
  },
  // Index for interview type filtering
  { 
    key: { type: 1 } 
  },
  // Index for status filtering
  { 
    key: { status: 1 } 
  },
  // Text index for search functionality
  { 
    key: { 
      candidateName: 'text',
      jobTitle: 'text',
      notes: 'text'
    },
    options: { 
      name: 'interview_text_search',
      weights: {
        candidateName: 10,
        jobTitle: 8,
        notes: 3
      }
    }
  },
  // Active interviews index
  { 
    key: { 'metadata.isActive': 1 } 
  },
  // Created date index for sorting
  { 
    key: { 'metadata.createdAt': -1 } 
  },
  // Scheduled date index for sorting and filtering
  { 
    key: { scheduledDate: 1 } 
  }
];