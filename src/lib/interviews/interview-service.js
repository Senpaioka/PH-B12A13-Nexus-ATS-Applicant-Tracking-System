/**
 * Interview Service
 * Core business logic for interview management operations
 */

import { ObjectId } from 'mongodb';
import { 
  getInterviewsCollection, 
  initializeInterviewsCollection,
  hasScheduleConflict,
  getInterviewsForDate
} from './interview-db.js';
import { 
  createInterviewDocument,
  formatInterviewForDisplay,
  generateInterviewerInitials,
  isInterviewToday,
  INTERVIEW_STATUS,
  INTERVIEW_TYPES
} from './interview-models.js';
import { 
  validateInterviewData,
  sanitizeInterviewInput,
  validatePaginationParams,
  validateInterviewFilters,
  ValidationError
} from './interview-validation.js';
import { candidateService } from '../candidates/candidate-service.js';
import { getJobById } from '../jobs/job-service.js';

/**
 * Service error class
 */
export class InterviewServiceError extends Error {
  constructor(message, code = 'INTERVIEW_SERVICE_ERROR', statusCode = 500) {
    super(message);
    this.name = 'InterviewServiceError';
    this.code = code;
    this.statusCode = statusCode;
  }
}

/**
 * Interview Service Class
 */
export class InterviewService {
  constructor() {
    this.initialized = false;
  }

  /**
   * Initialize the service and database
   */
  async initialize() {
    if (!this.initialized) {
      try {
        await initializeInterviewsCollection();
        this.initialized = true;
        console.log('Interview service initialized successfully');
      } catch (error) {
        console.error('Failed to initialize interview service:', error);
        throw new InterviewServiceError(
          'Failed to initialize interview service',
          'INITIALIZATION_ERROR',
          500
        );
      }
    }
  }

  /**
   * Validates that referenced candidate and job exist
   * @param {string} candidateId - Candidate ID
   * @param {string} jobId - Job ID
   * @returns {Promise<Object>} Candidate and job information
   * @private
   */
  async _validateReferences(candidateId, jobId) {
    const errors = [];

    // Validate candidate exists
    let candidate = null;
    try {
      candidate = await candidateService.getCandidateById(candidateId);
      if (!candidate) {
        errors.push({ field: 'candidateId', message: 'Referenced candidate does not exist' });
      }
    } catch (error) {
      console.error('Error validating candidate reference:', error);
      errors.push({ field: 'candidateId', message: 'Failed to validate candidate reference' });
    }

    // Validate job exists
    let job = null;
    try {
      job = await getJobById(jobId);
      if (!job) {
        errors.push({ field: 'jobId', message: 'Referenced job does not exist' });
      }
    } catch (error) {
      console.error('Error validating job reference:', error);
      errors.push({ field: 'jobId', message: 'Failed to validate job reference' });
    }

    if (errors.length > 0) {
      throw new InterviewServiceError(
        'Referential integrity validation failed',
        'INVALID_REFERENCES',
        400
      );
    }

    return { candidate, job };
  }

  /**
   * Enriches interview data with current candidate and job information
   * @param {Object} interview - Interview document
   * @returns {Promise<Object>} Enriched interview data
   * @private
   */
  async _enrichInterviewData(interview) {
    try {
      const enriched = { ...interview };

      // Try to get current candidate information
      if (interview.candidateId) {
        try {
          const candidate = await candidateService.getCandidateById(interview.candidateId.toString());
          if (candidate) {
            enriched.currentCandidateInfo = {
              name: `${candidate.personalInfo.firstName} ${candidate.personalInfo.lastName}`,
              email: candidate.personalInfo.email,
              currentStage: candidate.pipelineInfo.currentStage
            };
          } else {
            enriched.currentCandidateInfo = null;
            enriched.candidateDeleted = true;
          }
        } catch (error) {
          console.warn('Failed to enrich candidate data:', error);
          enriched.currentCandidateInfo = null;
        }
      }

      // Try to get current job information
      if (interview.jobId) {
        try {
          const job = await getJobById(interview.jobId.toString());
          if (job) {
            enriched.currentJobInfo = {
              title: job.title,
              department: job.department,
              status: job.status
            };
          } else {
            enriched.currentJobInfo = null;
            enriched.jobDeleted = true;
          }
        } catch (error) {
          console.warn('Failed to enrich job data:', error);
          enriched.currentJobInfo = null;
        }
      }

      return enriched;
    } catch (error) {
      console.error('Failed to enrich interview data:', error);
      return interview; // Return original data if enrichment fails
    }
  }

  /**
   * Creates a new interview
   * @param {Object} interviewData - Interview data
   * @param {string} userId - ID of user creating the interview
   * @returns {Promise<Object>} Created interview
   */
  async createInterview(interviewData, userId = null) {
    try {
      await this.initialize();

      // Sanitize and validate input data
      const sanitizedData = sanitizeInterviewInput(interviewData);
      validateInterviewData(sanitizedData);

      // Validate that referenced candidate and job exist
      const { candidate, job } = await this._validateReferences(
        sanitizedData.candidateId, 
        sanitizedData.jobId
      );

      // Use current candidate and job names if not provided
      if (!sanitizedData.candidateName && candidate) {
        sanitizedData.candidateName = `${candidate.personalInfo.firstName} ${candidate.personalInfo.lastName}`;
      }
      if (!sanitizedData.jobTitle && job) {
        sanitizedData.jobTitle = job.title;
      }

      // Check for schedule conflicts
      if (sanitizedData.candidateId && sanitizedData.date && sanitizedData.time) {
        const scheduledDate = new Date(`${sanitizedData.date}T${sanitizedData.time}:00`);
        const hasConflict = await hasScheduleConflict(
          new ObjectId(sanitizedData.candidateId), 
          scheduledDate
        );
        
        if (hasConflict) {
          throw new InterviewServiceError(
            'Schedule conflict: Candidate already has an interview scheduled within 30 minutes of this time',
            'SCHEDULE_CONFLICT',
            409
          );
        }
      }

      // Add creator information
      sanitizedData.createdBy = userId;

      // Create interview document
      const interviewDoc = createInterviewDocument(sanitizedData);
      
      const collection = await getInterviewsCollection();
      const result = await collection.insertOne(interviewDoc);

      if (!result.insertedId) {
        throw new InterviewServiceError(
          'Failed to create interview',
          'INSERT_FAILED',
          500
        );
      }

      // Return the created interview with enriched data
      const createdInterview = await collection.findOne({ _id: result.insertedId });
      const enrichedInterview = await this._enrichInterviewData(createdInterview);
      
      console.log(`Created interview: ${result.insertedId} for candidate ${sanitizedData.candidateName}`);
      return formatInterviewForDisplay(enrichedInterview);

    } catch (error) {
      if (error instanceof ValidationError) {
        throw new InterviewServiceError(
          error.message,
          'VALIDATION_ERROR',
          400
        );
      }
      if (error instanceof InterviewServiceError) {
        throw error;
      }
      
      console.error('Failed to create interview:', error);
      throw new InterviewServiceError(
        'Failed to create interview',
        'CREATE_ERROR',
        500
      );
    }
  }

  /**
   * Gets an interview by ID
   * @param {string} interviewId - Interview ID
   * @returns {Promise<Object|null>} Interview or null if not found
   */
  async getInterviewById(interviewId) {
    try {
      await this.initialize();

      if (!ObjectId.isValid(interviewId)) {
        throw new InterviewServiceError(
          'Invalid interview ID format',
          'INVALID_ID',
          400
        );
      }

      const collection = await getInterviewsCollection();
      const interview = await collection.findOne({ 
        _id: new ObjectId(interviewId),
        'metadata.isActive': true
      });

      if (!interview) {
        return null;
      }

      // Enrich with current candidate and job data
      const enrichedInterview = await this._enrichInterviewData(interview);
      return formatInterviewForDisplay(enrichedInterview);

    } catch (error) {
      if (error instanceof InterviewServiceError) {
        throw error;
      }
      
      console.error('Failed to get interview:', error);
      throw new InterviewServiceError(
        'Failed to retrieve interview',
        'GET_ERROR',
        500
      );
    }
  }

  /**
   * Gets all interviews with filtering and pagination
   * @param {Object} filters - Filter criteria
   * @param {Object} pagination - Pagination parameters
   * @returns {Promise<Object>} Paginated interviews list
   */
  async getAllInterviews(filters = {}, pagination = {}) {
    try {
      await this.initialize();

      const { page, limit, skip } = validatePaginationParams(pagination);
      const validatedFilters = validateInterviewFilters(filters);
      
      // Build query
      const query = { 'metadata.isActive': true };
      
      // Apply filters
      if (validatedFilters.status) {
        query.status = validatedFilters.status;
      }
      
      if (validatedFilters.type) {
        query.type = validatedFilters.type;
      }
      
      if (validatedFilters.candidateId) {
        query.candidateId = validatedFilters.candidateId;
      }
      
      if (validatedFilters.jobId) {
        query.jobId = validatedFilters.jobId;
      }

      // Date range filtering
      if (validatedFilters.startDate || validatedFilters.endDate) {
        query.scheduledDate = {};
        if (validatedFilters.startDate) {
          query.scheduledDate.$gte = validatedFilters.startDate;
        }
        if (validatedFilters.endDate) {
          const endDate = new Date(validatedFilters.endDate);
          endDate.setHours(23, 59, 59, 999); // End of day
          query.scheduledDate.$lte = endDate;
        }
      }

      const collection = await getInterviewsCollection();
      
      // Get total count and interviews
      const [total, interviews] = await Promise.all([
        collection.countDocuments(query),
        collection
          .find(query)
          .sort({ scheduledDate: 1 }) // Sort by date ascending
          .skip(skip)
          .limit(limit)
          .toArray()
      ]);

      // Enrich interviews with current candidate and job data
      const enrichedInterviews = await Promise.all(
        interviews.map(interview => this._enrichInterviewData(interview))
      );

      return {
        interviews: enrichedInterviews.map(formatInterviewForDisplay),
        pagination: {
          page,
          limit,
          total,
          pages: Math.ceil(total / limit),
          hasNext: page * limit < total,
          hasPrev: page > 1
        }
      };

    } catch (error) {
      console.error('Failed to get interviews:', error);
      throw new InterviewServiceError(
        'Failed to retrieve interviews',
        'LIST_ERROR',
        500
      );
    }
  }

  /**
   * Updates an interview
   * @param {string} interviewId - Interview ID
   * @param {Object} updates - Update data
   * @param {string} userId - ID of user making the update
   * @returns {Promise<Object>} Updated interview
   */
  async updateInterview(interviewId, updates, userId = null) {
    try {
      await this.initialize();

      if (!ObjectId.isValid(interviewId)) {
        throw new InterviewServiceError(
          'Invalid interview ID format',
          'INVALID_ID',
          400
        );
      }

      // Get existing interview
      const existingInterview = await this.getInterviewById(interviewId);
      if (!existingInterview) {
        throw new InterviewServiceError(
          'Interview not found',
          'NOT_FOUND',
          404
        );
      }

      // Sanitize and validate update data
      const sanitizedUpdates = sanitizeInterviewInput(updates);
      
      // If updating schedule, check for conflicts
      if ((sanitizedUpdates.date || sanitizedUpdates.time) && sanitizedUpdates.candidateId) {
        const newDate = sanitizedUpdates.date || existingInterview.date;
        const newTime = sanitizedUpdates.time || existingInterview.time;
        const scheduledDate = new Date(`${newDate}T${newTime}:00`);
        
        const hasConflict = await hasScheduleConflict(
          new ObjectId(sanitizedUpdates.candidateId), 
          scheduledDate,
          new ObjectId(interviewId)
        );
        
        if (hasConflict) {
          throw new InterviewServiceError(
            'Schedule conflict: Candidate already has an interview scheduled within 30 minutes of this time',
            'SCHEDULE_CONFLICT',
            409
          );
        }
      }

      // Build update document
      const updateDoc = {
        $set: {
          'metadata.updatedAt': new Date()
        }
      };

      // Update fields that are provided
      const updatableFields = [
        'candidateName', 'jobTitle', 'type', 'interviewers', 
        'notes', 'status'
      ];
      
      updatableFields.forEach(field => {
        if (sanitizedUpdates[field] !== undefined) {
          updateDoc.$set[field] = sanitizedUpdates[field];
        }
      });

      // Handle date/time updates
      if (sanitizedUpdates.date && sanitizedUpdates.time) {
        const scheduledDate = new Date(`${sanitizedUpdates.date}T${sanitizedUpdates.time}:00`);
        updateDoc.$set.scheduledDate = scheduledDate;
      }

      // Handle meeting details updates
      if (sanitizedUpdates.meetingType || sanitizedUpdates.meetingLink || sanitizedUpdates.location) {
        updateDoc.$set.meetingDetails = {
          type: sanitizedUpdates.meetingType || existingInterview.meetingDetails?.type,
          link: sanitizedUpdates.meetingLink || existingInterview.meetingDetails?.link,
          location: sanitizedUpdates.location || existingInterview.meetingDetails?.location
        };
      }

      const collection = await getInterviewsCollection();
      const result = await collection.findOneAndUpdate(
        { _id: new ObjectId(interviewId), 'metadata.isActive': true },
        updateDoc,
        { returnDocument: 'after' }
      );

      if (!result) {
        throw new InterviewServiceError(
          'Failed to update interview',
          'UPDATE_FAILED',
          500
        );
      }

      console.log(`Updated interview: ${interviewId}`);
      return formatInterviewForDisplay(result);

    } catch (error) {
      if (error instanceof ValidationError) {
        throw new InterviewServiceError(
          error.message,
          'VALIDATION_ERROR',
          400
        );
      }
      if (error instanceof InterviewServiceError) {
        throw error;
      }
      
      console.error('Failed to update interview:', error);
      throw new InterviewServiceError(
        'Failed to update interview',
        'UPDATE_ERROR',
        500
      );
    }
  }

  /**
   * Deletes an interview (soft delete)
   * @param {string} interviewId - Interview ID
   * @param {string} userId - ID of user deleting the interview
   * @returns {Promise<boolean>} Success status
   */
  async deleteInterview(interviewId, userId = null) {
    try {
      await this.initialize();

      if (!ObjectId.isValid(interviewId)) {
        throw new InterviewServiceError(
          'Invalid interview ID format',
          'INVALID_ID',
          400
        );
      }

      const collection = await getInterviewsCollection();
      const result = await collection.findOneAndUpdate(
        { _id: new ObjectId(interviewId), 'metadata.isActive': true },
        {
          $set: {
            'metadata.isActive': false,
            'metadata.deletedAt': new Date(),
            'metadata.deletedBy': userId ? new ObjectId(userId) : null
          }
        }
      );

      if (!result) {
        throw new InterviewServiceError(
          'Interview not found',
          'NOT_FOUND',
          404
        );
      }

      console.log(`Deleted interview: ${interviewId}`);
      return true;

    } catch (error) {
      if (error instanceof InterviewServiceError) {
        throw error;
      }
      
      console.error('Failed to delete interview:', error);
      throw new InterviewServiceError(
        'Failed to delete interview',
        'DELETE_ERROR',
        500
      );
    }
  }

  /**
   * Gets interview statistics for a specific date
   * @param {Date} date - Date to get statistics for (defaults to today)
   * @returns {Promise<Object>} Interview statistics
   */
  async getInterviewStats(date = new Date()) {
    try {
      await this.initialize();

      const interviews = await getInterviewsForDate(date);
      const todayInterviews = interviews.filter(interview => 
        interview.status === INTERVIEW_STATUS.SCHEDULED || 
        interview.status === INTERVIEW_STATUS.RESCHEDULED
      );

      // Generate interviewer initials
      const allInterviewers = todayInterviews.flatMap(interview => interview.interviewers || []);
      const uniqueInterviewers = [...new Set(allInterviewers)];
      const interviewerInitials = generateInterviewerInitials(uniqueInterviewers);

      return {
        date: date.toISOString().split('T')[0],
        totalInterviews: todayInterviews.length,
        interviewerInitials: interviewerInitials,
        interviewsByType: todayInterviews.reduce((acc, interview) => {
          acc[interview.type] = (acc[interview.type] || 0) + 1;
          return acc;
        }, {}),
        interviews: todayInterviews.map(formatInterviewForDisplay)
      };

    } catch (error) {
      console.error('Failed to get interview statistics:', error);
      throw new InterviewServiceError(
        'Failed to get interview statistics',
        'STATS_ERROR',
        500
      );
    }
  }

  /**
   * Gets available candidates and jobs for interview creation
   * @returns {Promise<Object>} Available candidates and jobs
   */
  async getAvailableOptions() {
    try {
      await this.initialize();

      // Get active candidates
      const candidatesResult = await candidateService.listCandidates(
        { stage: { $ne: 'hired' } }, // Exclude hired candidates
        { limit: 100 }
      );

      // Get active jobs (we'll need to implement this in job service)
      let jobs = [];
      try {
        // For now, we'll get jobs directly from the collection
        // This should be replaced with a proper job service method
        const { getJobsCollection } = await import('../jobs/job-service.js');
        const jobsCollection = await getJobsCollection();
        jobs = await jobsCollection.find({ status: 'active' }).limit(100).toArray();
        jobs = jobs.map(job => ({
          id: job._id.toString(),
          title: job.title,
          department: job.department,
          location: job.location
        }));
      } catch (error) {
        console.warn('Failed to get jobs:', error);
        jobs = [];
      }

      return {
        candidates: candidatesResult.candidates.map(candidate => ({
          id: candidate._id.toString(),
          name: `${candidate.personalInfo.firstName} ${candidate.personalInfo.lastName}`,
          email: candidate.personalInfo.email,
          currentStage: candidate.pipelineInfo.currentStage
        })),
        jobs: jobs
      };

    } catch (error) {
      console.error('Failed to get available options:', error);
      throw new InterviewServiceError(
        'Failed to get available options',
        'OPTIONS_ERROR',
        500
      );
    }
  }

  /**
   * Gets interviews within a date range
   * @param {Date} startDate - Start date
   * @param {Date} endDate - End date
   * @returns {Promise<Array>} Array of interviews
   */
  async getInterviewsByDateRange(startDate, endDate) {
    try {
      await this.initialize();

      const collection = await getInterviewsCollection();
      
      const interviews = await collection.find({
        scheduledDate: {
          $gte: startDate,
          $lte: endDate
        },
        'metadata.isActive': true
      }).sort({ scheduledDate: 1 }).toArray();

      return interviews.map(formatInterviewForDisplay);

    } catch (error) {
      console.error('Failed to get interviews by date range:', error);
      throw new InterviewServiceError(
        'Failed to get interviews by date range',
        'DATE_RANGE_ERROR',
        500
      );
    }
  }

  /**
   * Gets interviews for a specific date
   * @param {Date} date - Target date
   * @returns {Promise<Array>} Array of interviews for the date
   */
  async getInterviewsByDate(date) {
    try {
      await this.initialize();

      // Create date range for the entire day
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      return await this.getInterviewsByDateRange(startOfDay, endOfDay);

    } catch (error) {
      console.error('Failed to get interviews by date:', error);
      throw new InterviewServiceError(
        'Failed to get interviews by date',
        'DATE_ERROR',
        500
      );
    }
  }
}

// Export singleton instance
export const interviewService = new InterviewService();