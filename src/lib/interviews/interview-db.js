/**
 * Interview Database Operations
 * Handles MongoDB operations for interview management
 */

import { getCollection } from '../mongodb.js';
import { INTERVIEW_INDEXES } from './interview-models.js';

/**
 * Collection name for interviews
 */
export const INTERVIEWS_COLLECTION = 'interviews';

/**
 * Gets the interviews collection
 * @returns {Promise<Collection>} MongoDB interviews collection
 */
export async function getInterviewsCollection() {
  try {
    return await getCollection(INTERVIEWS_COLLECTION);
  } catch (error) {
    console.error('Failed to get interviews collection:', error);
    throw new Error(`Failed to access interviews collection: ${error.message}`);
  }
}

/**
 * Initializes the interviews collection with proper indexes
 * @returns {Promise<void>}
 */
export async function initializeInterviewsCollection() {
  try {
    console.log('Initializing interviews collection...');
    
    const collection = await getInterviewsCollection();
    
    // Create indexes for optimal performance
    for (const indexSpec of INTERVIEW_INDEXES) {
      try {
        await collection.createIndex(indexSpec.key, indexSpec.options || {});
        console.log(`Created interview index: ${JSON.stringify(indexSpec.key)}`);
      } catch (error) {
        // Index might already exist, log but don't fail
        if (error.code !== 85) { // Index already exists error code
          console.warn(`Failed to create interview index ${JSON.stringify(indexSpec.key)}:`, error.message);
        }
      }
    }
    
    console.log('Interviews collection initialized successfully');
  } catch (error) {
    console.error('Failed to initialize interviews collection:', error);
    throw new Error(`Failed to initialize interviews collection: ${error.message}`);
  }
}

/**
 * Checks if there are conflicting interviews for the same candidate at the same time
 * @param {string} candidateId - Candidate ID
 * @param {Date} scheduledDate - Interview date and time
 * @param {string} excludeId - Optional interview ID to exclude from check (for updates)
 * @returns {Promise<boolean>} True if there's a conflict
 */
export async function hasScheduleConflict(candidateId, scheduledDate, excludeId = null) {
  try {
    const collection = await getInterviewsCollection();
    
    // Check for interviews within 30 minutes of the scheduled time
    const startTime = new Date(scheduledDate.getTime() - 30 * 60 * 1000); // 30 minutes before
    const endTime = new Date(scheduledDate.getTime() + 30 * 60 * 1000); // 30 minutes after
    
    const query = {
      candidateId: candidateId,
      scheduledDate: {
        $gte: startTime,
        $lte: endTime
      },
      status: { $in: ['scheduled', 'rescheduled'] },
      'metadata.isActive': true
    };
    
    // Exclude specific ID if provided (for updates)
    if (excludeId) {
      query._id = { $ne: excludeId };
    }
    
    const count = await collection.countDocuments(query);
    return count > 0;
  } catch (error) {
    console.error('Failed to check schedule conflict:', error);
    throw new Error(`Failed to check schedule conflict: ${error.message}`);
  }
}

/**
 * Gets interviews scheduled for a specific date
 * @param {Date} date - Target date
 * @returns {Promise<Array>} Array of interviews for the date
 */
export async function getInterviewsForDate(date) {
  try {
    const collection = await getInterviewsCollection();
    
    // Create date range for the entire day
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    
    const interviews = await collection.find({
      scheduledDate: {
        $gte: startOfDay,
        $lte: endOfDay
      },
      'metadata.isActive': true
    }).sort({ scheduledDate: 1 }).toArray();
    
    return interviews;
  } catch (error) {
    console.error('Failed to get interviews for date:', error);
    throw new Error(`Failed to get interviews for date: ${error.message}`);
  }
}

/**
 * Gets collection statistics
 * @returns {Promise<Object>} Collection statistics
 */
export async function getInterviewsStats() {
  try {
    const collection = await getInterviewsCollection();
    
    const [totalCount, activeCount, statusStats, typeStats] = await Promise.all([
      collection.countDocuments({}),
      collection.countDocuments({ 'metadata.isActive': true }),
      collection.aggregate([
        { $match: { 'metadata.isActive': true } },
        { $group: { 
          _id: '$status', 
          count: { $sum: 1 } 
        }}
      ]).toArray(),
      collection.aggregate([
        { $match: { 'metadata.isActive': true } },
        { $group: { 
          _id: '$type', 
          count: { $sum: 1 } 
        }}
      ]).toArray()
    ]);
    
    return {
      total: totalCount,
      active: activeCount,
      byStatus: statusStats.reduce((acc, status) => {
        acc[status._id] = status.count;
        return acc;
      }, {}),
      byType: typeStats.reduce((acc, type) => {
        acc[type._id] = type.count;
        return acc;
      }, {})
    };
  } catch (error) {
    console.error('Failed to get interviews statistics:', error);
    throw new Error(`Failed to get interviews statistics: ${error.message}`);
  }
}

/**
 * Performs database health check for interviews collection
 * @returns {Promise<Object>} Health check results
 */
export async function performHealthCheck() {
  try {
    const collection = await getInterviewsCollection();
    
    // Test basic operations
    const testQuery = await collection.findOne({}, { projection: { _id: 1 } });
    const indexInfo = await collection.indexes();
    
    return {
      status: 'healthy',
      collection: INTERVIEWS_COLLECTION,
      indexCount: indexInfo.length,
      canQuery: true,
      timestamp: new Date()
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      collection: INTERVIEWS_COLLECTION,
      error: error.message,
      timestamp: new Date()
    };
  }
}