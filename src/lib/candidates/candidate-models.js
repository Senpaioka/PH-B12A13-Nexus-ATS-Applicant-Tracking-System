/**
 * Candidate Data Models and Schema Definitions
 * Defines the structure and validation for candidate records
 */

import { ObjectId } from 'mongodb';

/**
 * Pipeline stages enum
 */
export const PIPELINE_STAGES = {
  APPLIED: 'applied',
  SCREENING: 'screening', 
  INTERVIEW: 'interview',
  OFFER: 'offer',
  HIRED: 'hired'
};

/**
 * Valid pipeline stage transitions
 * Note: Allows flexible transitions for real-world scenarios
 * All stages can transition to any other stage for maximum flexibility
 */
export const VALID_STAGE_TRANSITIONS = {
  [PIPELINE_STAGES.APPLIED]: [PIPELINE_STAGES.SCREENING, PIPELINE_STAGES.INTERVIEW, PIPELINE_STAGES.OFFER, PIPELINE_STAGES.HIRED],
  [PIPELINE_STAGES.SCREENING]: [PIPELINE_STAGES.APPLIED, PIPELINE_STAGES.INTERVIEW, PIPELINE_STAGES.OFFER, PIPELINE_STAGES.HIRED],
  [PIPELINE_STAGES.INTERVIEW]: [PIPELINE_STAGES.APPLIED, PIPELINE_STAGES.SCREENING, PIPELINE_STAGES.OFFER, PIPELINE_STAGES.HIRED],
  [PIPELINE_STAGES.OFFER]: [PIPELINE_STAGES.APPLIED, PIPELINE_STAGES.SCREENING, PIPELINE_STAGES.INTERVIEW, PIPELINE_STAGES.HIRED],
  [PIPELINE_STAGES.HIRED]: [PIPELINE_STAGES.APPLIED, PIPELINE_STAGES.SCREENING, PIPELINE_STAGES.INTERVIEW, PIPELINE_STAGES.OFFER] // Allow moving back from hired if needed
};

/**
 * Document types enum
 */
export const DOCUMENT_TYPES = {
  RESUME: 'resume',
  COVER_LETTER: 'cover_letter',
  PORTFOLIO: 'portfolio',
  OTHER: 'other'
};

/**
 * Application sources enum
 */
export const APPLICATION_SOURCES = {
  LINKEDIN: 'linkedin',
  WEBSITE: 'website',
  REFERRAL: 'referral',
  AGENCY: 'agency',
  OTHER: 'other'
};

/**
 * Note types enum
 */
export const NOTE_TYPES = {
  SCREENING: 'screening',
  INTERVIEW: 'interview',
  GENERAL: 'general'
};

/**
 * Creates a new candidate document structure
 * @param {Object} candidateData - Raw candidate data
 * @returns {Object} Formatted candidate document
 */
export function createCandidateDocument(candidateData) {
  const now = new Date();
  
  return {
    personalInfo: {
      firstName: candidateData.firstName?.trim(),
      lastName: candidateData.lastName?.trim(),
      email: candidateData.email?.toLowerCase().trim(),
      phone: candidateData.phone?.trim(),
      location: candidateData.location?.trim()
    },
    professionalInfo: {
      currentRole: candidateData.currentRole?.trim(),
      experience: candidateData.experience?.trim(),
      skills: Array.isArray(candidateData.skills) 
        ? candidateData.skills.map(skill => skill.trim()).filter(Boolean)
        : [],
      appliedForRole: candidateData.appliedForRole?.trim(),
      source: candidateData.source || APPLICATION_SOURCES.OTHER
    },
    pipelineInfo: {
      currentStage: candidateData.currentStage || PIPELINE_STAGES.APPLIED,
      stageHistory: [{
        stage: candidateData.currentStage || PIPELINE_STAGES.APPLIED,
        timestamp: now,
        updatedBy: candidateData.createdBy && ObjectId.isValid(candidateData.createdBy) 
          ? new ObjectId(candidateData.createdBy) 
          : null,
        notes: candidateData.initialNotes || ''
      }],
      appliedDate: candidateData.appliedDate ? new Date(candidateData.appliedDate) : now
    },
    documents: [],
    jobApplications: [],
    notes: [],
    metadata: {
      createdAt: now,
      updatedAt: now,
      createdBy: candidateData.createdBy && ObjectId.isValid(candidateData.createdBy) 
        ? new ObjectId(candidateData.createdBy) 
        : null,
      isActive: true
    }
  };
}

/**
 * Creates a stage history entry
 * @param {string} fromStage - Previous stage
 * @param {string} toStage - New stage
 * @param {string} updatedBy - User ID who made the change
 * @param {string} notes - Optional notes
 * @returns {Object} Stage history entry
 */
export function createStageHistoryEntry(fromStage, toStage, updatedBy, notes = '') {
  return {
    fromStage,
    toStage,
    timestamp: new Date(),
    updatedBy: updatedBy && ObjectId.isValid(updatedBy) 
      ? new ObjectId(updatedBy) 
      : null,
    notes: notes?.trim() || ''
  };
}

/**
 * Creates a document metadata entry
 * @param {Object} documentData - Document information
 * @returns {Object} Document metadata
 */
export function createDocumentMetadata(documentData) {
  return {
    _id: new ObjectId(),
    filename: documentData.filename,
    originalName: documentData.originalName,
    mimeType: documentData.mimeType,
    size: documentData.size,
    uploadDate: new Date(),
    documentType: documentData.documentType || DOCUMENT_TYPES.OTHER,
    filePath: documentData.filePath,
    uploadedBy: documentData.uploadedBy && ObjectId.isValid(documentData.uploadedBy) 
      ? new ObjectId(documentData.uploadedBy) 
      : null,
    isActive: true
  };
}

/**
 * Creates a note entry
 * @param {Object} noteData - Note information
 * @returns {Object} Note entry
 */
export function createNoteEntry(noteData) {
  return {
    _id: new ObjectId(),
    content: noteData.content?.trim(),
    createdBy: noteData.createdBy && ObjectId.isValid(noteData.createdBy) 
      ? new ObjectId(noteData.createdBy) 
      : null,
    createdAt: new Date(),
    type: noteData.type || NOTE_TYPES.GENERAL
  };
}

/**
 * Creates a job application entry
 * @param {Object} applicationData - Application information
 * @returns {Object} Job application entry
 */
export function createJobApplicationEntry(applicationData) {
  return {
    jobId: applicationData.jobId && ObjectId.isValid(applicationData.jobId) 
      ? new ObjectId(applicationData.jobId) 
      : null,
    appliedDate: applicationData.appliedDate ? new Date(applicationData.appliedDate) : new Date(),
    status: applicationData.status || 'active',
    source: applicationData.source || APPLICATION_SOURCES.OTHER
  };
}

/**
 * MongoDB indexes for optimal query performance
 */
export const CANDIDATE_INDEXES = [
  // Unique email index for duplicate prevention
  { 
    key: { 'personalInfo.email': 1 }, 
    options: { unique: true, sparse: true } 
  },
  // Pipeline stage index for filtering
  { 
    key: { 'pipelineInfo.currentStage': 1 } 
  },
  // Skills index for search
  { 
    key: { 'professionalInfo.skills': 1 } 
  },
  // Location index for filtering
  { 
    key: { 'personalInfo.location': 1 } 
  },
  // Applied date index for sorting
  { 
    key: { 'pipelineInfo.appliedDate': -1 } 
  },
  // Text search index for name and role search
  { 
    key: { 
      'personalInfo.firstName': 'text',
      'personalInfo.lastName': 'text',
      'professionalInfo.currentRole': 'text',
      'professionalInfo.appliedForRole': 'text'
    },
    options: { 
      name: 'candidate_text_search',
      weights: {
        'personalInfo.firstName': 10,
        'personalInfo.lastName': 10,
        'professionalInfo.currentRole': 5,
        'professionalInfo.appliedForRole': 5
      }
    }
  },
  // Active candidates index
  { 
    key: { 'metadata.isActive': 1 } 
  },
  // Created date index for sorting
  { 
    key: { 'metadata.createdAt': -1 } 
  }
];