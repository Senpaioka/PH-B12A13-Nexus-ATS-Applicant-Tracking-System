/**
 * Interview Data Validation
 * Provides validation functions for interview data integrity
 */

import { ObjectId } from 'mongodb';
import { 
  INTERVIEW_TYPES, 
  INTERVIEW_STATUS, 
  MEETING_TYPES,
  DEFAULT_DURATIONS 
} from './interview-models.js';

/**
 * Time format validation regex (HH:MM format)
 */
const TIME_REGEX = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;

/**
 * Date format validation regex (YYYY-MM-DD format)
 */
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

/**
 * URL validation regex for meeting links
 */
const URL_REGEX = /^https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)$/;

/**
 * Validation error class
 */
export class ValidationError extends Error {
  constructor(message, field = null) {
    super(message);
    this.name = 'ValidationError';
    this.field = field;
  }
}

/**
 * Validates interview basic information
 * @param {Object} interviewData - Interview data object
 * @throws {ValidationError} If validation fails
 */
export function validateInterviewBasicInfo(interviewData) {
  const errors = [];

  // Candidate ID validation
  if (!interviewData.candidateId) {
    errors.push({ field: 'candidateId', message: 'Candidate ID is required' });
  } else if (!ObjectId.isValid(interviewData.candidateId)) {
    errors.push({ field: 'candidateId', message: 'Candidate ID must be a valid ObjectId' });
  }

  // Candidate name validation
  if (!interviewData.candidateName || typeof interviewData.candidateName !== 'string') {
    errors.push({ field: 'candidateName', message: 'Candidate name is required and must be a string' });
  } else if (interviewData.candidateName.trim().length < 1) {
    errors.push({ field: 'candidateName', message: 'Candidate name cannot be empty' });
  } else if (interviewData.candidateName.trim().length > 100) {
    errors.push({ field: 'candidateName', message: 'Candidate name cannot exceed 100 characters' });
  }

  // Job ID validation
  if (!interviewData.jobId) {
    errors.push({ field: 'jobId', message: 'Job ID is required' });
  } else if (!ObjectId.isValid(interviewData.jobId)) {
    errors.push({ field: 'jobId', message: 'Job ID must be a valid ObjectId' });
  }

  // Job title validation
  if (!interviewData.jobTitle || typeof interviewData.jobTitle !== 'string') {
    errors.push({ field: 'jobTitle', message: 'Job title is required and must be a string' });
  } else if (interviewData.jobTitle.trim().length < 1) {
    errors.push({ field: 'jobTitle', message: 'Job title cannot be empty' });
  } else if (interviewData.jobTitle.trim().length > 100) {
    errors.push({ field: 'jobTitle', message: 'Job title cannot exceed 100 characters' });
  }

  // Interview type validation
  if (!interviewData.type) {
    errors.push({ field: 'type', message: 'Interview type is required' });
  } else if (!Object.values(INTERVIEW_TYPES).includes(interviewData.type)) {
    errors.push({ 
      field: 'type', 
      message: `Interview type must be one of: ${Object.values(INTERVIEW_TYPES).join(', ')}` 
    });
  }

  if (errors.length > 0) {
    throw new ValidationError('Interview basic information validation failed', errors);
  }
}

/**
 * Validates interview date and time constraints
 * @param {string} date - Date in YYYY-MM-DD format
 * @param {string} time - Time in HH:MM format
 * @throws {ValidationError} If validation fails
 */
export function validateDateTimeConstraints(date, time) {
  const errors = [];

  // Date validation
  if (!date || typeof date !== 'string') {
    errors.push({ field: 'date', message: 'Date is required and must be a string' });
  } else if (!DATE_REGEX.test(date)) {
    errors.push({ field: 'date', message: 'Date must be in YYYY-MM-DD format' });
  } else {
    const dateObj = new Date(date);
    if (isNaN(dateObj.getTime())) {
      errors.push({ field: 'date', message: 'Date must be a valid date' });
    } else {
      // Check if date is not in the past (allow today)
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      dateObj.setHours(0, 0, 0, 0);
      
      if (dateObj < today) {
        errors.push({ field: 'date', message: 'Interview date cannot be in the past' });
      }
      
      // Check if date is not too far in the future (1 year limit)
      const oneYearFromNow = new Date();
      oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);
      oneYearFromNow.setHours(0, 0, 0, 0);
      
      if (dateObj > oneYearFromNow) {
        errors.push({ field: 'date', message: 'Interview date cannot be more than one year in the future' });
      }
    }
  }

  // Time validation
  if (!time || typeof time !== 'string') {
    errors.push({ field: 'time', message: 'Time is required and must be a string' });
  } else if (!TIME_REGEX.test(time)) {
    errors.push({ field: 'time', message: 'Time must be in HH:MM format (24-hour)' });
  } else {
    const [hours, minutes] = time.split(':').map(Number);
    
    // Business hours validation (8 AM to 6 PM)
    if (hours < 8 || hours > 18 || (hours === 18 && minutes > 0)) {
      errors.push({ field: 'time', message: 'Interview time must be between 08:00 and 18:00' });
    }
  }

  // Combined date-time validation for today
  if (date && time && DATE_REGEX.test(date) && TIME_REGEX.test(time)) {
    const dateObj = new Date(date);
    const [hours, minutes] = time.split(':').map(Number);
    dateObj.setHours(hours, minutes, 0, 0);
    
    const now = new Date();
    if (dateObj <= now) {
      errors.push({ field: 'datetime', message: 'Interview date and time must be in the future' });
    }
  }

  if (errors.length > 0) {
    throw new ValidationError('Date and time validation failed', errors);
  }
}

/**
 * Validates interview duration
 * @param {number} duration - Duration in minutes
 * @param {string} interviewType - Type of interview for default validation
 * @throws {ValidationError} If validation fails
 */
export function validateInterviewDuration(duration, interviewType) {
  const errors = [];

  if (duration !== undefined) {
    if (typeof duration !== 'number' || !Number.isInteger(duration)) {
      errors.push({ field: 'duration', message: 'Duration must be an integer number of minutes' });
    } else if (duration < 15) {
      errors.push({ field: 'duration', message: 'Interview duration must be at least 15 minutes' });
    } else if (duration > 480) { // 8 hours max
      errors.push({ field: 'duration', message: 'Interview duration cannot exceed 480 minutes (8 hours)' });
    } else if (duration % 15 !== 0) {
      errors.push({ field: 'duration', message: 'Interview duration must be in 15-minute increments' });
    }
  }

  if (errors.length > 0) {
    throw new ValidationError('Duration validation failed', errors);
  }
}

/**
 * Validates interviewer names
 * @param {Array<string>} interviewers - Array of interviewer names
 * @throws {ValidationError} If validation fails
 */
export function validateInterviewers(interviewers) {
  const errors = [];

  if (interviewers !== undefined) {
    if (!Array.isArray(interviewers)) {
      errors.push({ field: 'interviewers', message: 'Interviewers must be an array' });
    } else {
      if (interviewers.length > 10) {
        errors.push({ field: 'interviewers', message: 'Cannot have more than 10 interviewers' });
      }

      interviewers.forEach((interviewer, index) => {
        if (typeof interviewer !== 'string') {
          errors.push({ field: `interviewers[${index}]`, message: 'Each interviewer name must be a string' });
        } else if (interviewer.trim().length < 1) {
          errors.push({ field: `interviewers[${index}]`, message: 'Interviewer name cannot be empty' });
        } else if (interviewer.trim().length > 100) {
          errors.push({ field: `interviewers[${index}]`, message: 'Interviewer name cannot exceed 100 characters' });
        }
      });

      // Check for duplicate names
      const uniqueNames = new Set(interviewers.map(name => name.trim().toLowerCase()));
      if (uniqueNames.size !== interviewers.length) {
        errors.push({ field: 'interviewers', message: 'Interviewer names must be unique' });
      }
    }
  }

  if (errors.length > 0) {
    throw new ValidationError('Interviewers validation failed', errors);
  }
}

/**
 * Validates meeting details
 * @param {Object} meetingDetails - Meeting details object
 * @throws {ValidationError} If validation fails
 */
export function validateMeetingDetails(meetingDetails) {
  const errors = [];

  if (meetingDetails && typeof meetingDetails === 'object') {
    // Meeting type validation
    if (meetingDetails.type && !Object.values(MEETING_TYPES).includes(meetingDetails.type)) {
      errors.push({ 
        field: 'meetingType', 
        message: `Meeting type must be one of: ${Object.values(MEETING_TYPES).join(', ')}` 
      });
    }

    // Meeting link validation
    if (meetingDetails.link) {
      if (typeof meetingDetails.link !== 'string') {
        errors.push({ field: 'meetingLink', message: 'Meeting link must be a string' });
      } else if (meetingDetails.link.trim().length > 500) {
        errors.push({ field: 'meetingLink', message: 'Meeting link cannot exceed 500 characters' });
      } else if (!URL_REGEX.test(meetingDetails.link.trim())) {
        errors.push({ field: 'meetingLink', message: 'Meeting link must be a valid URL' });
      }
    }

    // Location validation
    if (meetingDetails.location) {
      if (typeof meetingDetails.location !== 'string') {
        errors.push({ field: 'location', message: 'Location must be a string' });
      } else if (meetingDetails.location.trim().length > 200) {
        errors.push({ field: 'location', message: 'Location cannot exceed 200 characters' });
      }
    }

    // Validate that video meetings have links and in-person meetings have locations
    // Note: We make meeting links optional for video meetings to allow scheduling without immediate link
    // if (meetingDetails.type === MEETING_TYPES.VIDEO && !meetingDetails.link) {
    //   errors.push({ field: 'meetingLink', message: 'Video interviews require a meeting link' });
    // }

    if (meetingDetails.type === MEETING_TYPES.IN_PERSON && !meetingDetails.location) {
      errors.push({ field: 'location', message: 'In-person interviews require a location' });
    }
  }

  if (errors.length > 0) {
    throw new ValidationError('Meeting details validation failed', errors);
  }
}

/**
 * Validates interview notes
 * @param {string} notes - Interview notes
 * @throws {ValidationError} If validation fails
 */
export function validateInterviewNotes(notes) {
  const errors = [];

  if (notes !== undefined && notes !== null) {
    if (typeof notes !== 'string') {
      errors.push({ field: 'notes', message: 'Notes must be a string' });
    } else if (notes.length > 2000) {
      errors.push({ field: 'notes', message: 'Notes cannot exceed 2000 characters' });
    }
  }

  if (errors.length > 0) {
    throw new ValidationError('Notes validation failed', errors);
  }
}

/**
 * Validates interview status
 * @param {string} status - Interview status
 * @throws {ValidationError} If validation fails
 */
export function validateInterviewStatus(status) {
  if (status && !Object.values(INTERVIEW_STATUS).includes(status)) {
    throw new ValidationError(
      `Interview status must be one of: ${Object.values(INTERVIEW_STATUS).join(', ')}`,
      'status'
    );
  }
}

/**
 * Validates complete interview data
 * @param {Object} interviewData - Complete interview data
 * @throws {ValidationError} If validation fails
 */
export function validateInterviewData(interviewData) {
  if (!interviewData || typeof interviewData !== 'object') {
    throw new ValidationError('Interview data is required and must be an object');
  }

  // Validate basic information
  validateInterviewBasicInfo(interviewData);

  // Validate date and time
  validateDateTimeConstraints(interviewData.date, interviewData.time);

  // Validate duration
  validateInterviewDuration(interviewData.duration, interviewData.type);

  // Validate interviewers
  validateInterviewers(interviewData.interviewers);

  // Validate meeting details
  const meetingDetails = {
    type: interviewData.meetingType,
    link: interviewData.meetingLink,
    location: interviewData.location
  };
  validateMeetingDetails(meetingDetails);

  // Validate notes
  validateInterviewNotes(interviewData.notes);

  // Validate status
  validateInterviewStatus(interviewData.status);
}

/**
 * Sanitizes interview input data
 * @param {Object} interviewData - Raw interview data
 * @returns {Object} Sanitized interview data
 */
export function sanitizeInterviewInput(interviewData) {
  if (!interviewData || typeof interviewData !== 'object') {
    return {};
  }

  const sanitized = { ...interviewData };

  // Sanitize string fields
  if (sanitized.candidateName) {
    sanitized.candidateName = sanitizeString(sanitized.candidateName);
  }
  
  if (sanitized.jobTitle) {
    sanitized.jobTitle = sanitizeString(sanitized.jobTitle);
  }

  if (sanitized.date) {
    sanitized.date = sanitized.date.trim();
  }

  if (sanitized.time) {
    sanitized.time = sanitized.time.trim();
  }

  if (sanitized.meetingLink) {
    sanitized.meetingLink = sanitized.meetingLink.trim();
  }

  if (sanitized.location) {
    sanitized.location = sanitizeString(sanitized.location);
  }

  if (sanitized.notes) {
    sanitized.notes = sanitizeString(sanitized.notes);
  }

  // Sanitize interviewer names
  if (Array.isArray(sanitized.interviewers)) {
    sanitized.interviewers = sanitized.interviewers
      .map(name => sanitizeString(name))
      .filter(Boolean);
  }

  // Ensure numeric fields are properly typed
  if (sanitized.duration !== undefined) {
    sanitized.duration = parseInt(sanitized.duration) || DEFAULT_DURATIONS[sanitized.type] || 60;
  }

  return sanitized;
}

/**
 * Sanitizes string input
 * @param {string} input - Raw string input
 * @returns {string} Sanitized string
 */
export function sanitizeString(input) {
  if (!input || typeof input !== 'string') {
    return '';
  }
  
  return input.trim().replace(/\s+/g, ' ');
}

/**
 * Validates pagination parameters
 * @param {Object} params - Pagination parameters
 * @returns {Object} Validated pagination parameters
 */
export function validatePaginationParams(params = {}) {
  const page = Math.max(1, parseInt(params.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(params.limit) || 20));
  const skip = (page - 1) * limit;

  return { page, limit, skip };
}

/**
 * Validates interview filter parameters
 * @param {Object} filters - Filter parameters
 * @returns {Object} Validated filter parameters
 */
export function validateInterviewFilters(filters = {}) {
  const validatedFilters = {};

  // Status filter
  if (filters.status) {
    if (Object.values(INTERVIEW_STATUS).includes(filters.status)) {
      validatedFilters.status = filters.status;
    }
  }

  // Type filter
  if (filters.type) {
    if (Object.values(INTERVIEW_TYPES).includes(filters.type)) {
      validatedFilters.type = filters.type;
    }
  }

  // Date range filters
  if (filters.startDate && DATE_REGEX.test(filters.startDate)) {
    validatedFilters.startDate = new Date(filters.startDate);
  }

  if (filters.endDate && DATE_REGEX.test(filters.endDate)) {
    validatedFilters.endDate = new Date(filters.endDate);
  }

  // Candidate ID filter
  if (filters.candidateId && ObjectId.isValid(filters.candidateId)) {
    validatedFilters.candidateId = new ObjectId(filters.candidateId);
  }

  // Job ID filter
  if (filters.jobId && ObjectId.isValid(filters.jobId)) {
    validatedFilters.jobId = new ObjectId(filters.jobId);
  }

  return validatedFilters;
}