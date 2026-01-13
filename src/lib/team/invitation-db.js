/**
 * Team Invitation Database Layer
 * Handles database operations for team invitations and members
 */

import { getCollection } from '../mongodb.js';
import { ObjectId } from 'mongodb';
import { 
  INVITATION_INDEXES, 
  TEAM_MEMBER_INDEXES,
  INVITATION_STATUS,
  MEMBER_STATUS,
  isInvitationExpired
} from './invitation-models.js';

/**
 * Collection names
 */
export const COLLECTIONS = {
  INVITATIONS: 'team_invitations',
  MEMBERS: 'team_members'
};

/**
 * Initializes database collections and indexes
 */
export async function initializeTeamCollections() {
  try {
    console.log('Initializing team invitation collections...');

    // Initialize invitations collection
    const invitationsCollection = await getCollection(COLLECTIONS.INVITATIONS);
    
    // Create indexes for invitations
    for (const indexSpec of INVITATION_INDEXES) {
      try {
        await invitationsCollection.createIndex(indexSpec.key, indexSpec.options || {});
      } catch (error) {
        // Ignore duplicate index errors
        if (error.code !== 85) {
          console.warn(`Warning: Could not create invitation index:`, error.message);
        }
      }
    }

    // Initialize team members collection
    const membersCollection = await getCollection(COLLECTIONS.MEMBERS);
    
    // Create indexes for team members
    for (const indexSpec of TEAM_MEMBER_INDEXES) {
      try {
        await membersCollection.createIndex(indexSpec.key, indexSpec.options || {});
      } catch (error) {
        // Ignore duplicate index errors
        if (error.code !== 85) {
          console.warn(`Warning: Could not create team member index:`, error.message);
        }
      }
    }

    console.log('Team invitation collections initialized successfully');
  } catch (error) {
    console.error('Failed to initialize team invitation collections:', error);
    throw error;
  }
}

/**
 * Creates a new invitation in the database
 * @param {Object} invitationDocument - Formatted invitation document
 * @returns {Promise<Object>} Created invitation with ID
 */
export async function createInvitation(invitationDocument) {
  try {
    const collection = await getCollection(COLLECTIONS.INVITATIONS);
    const result = await collection.insertOne(invitationDocument);
    
    return {
      ...invitationDocument,
      _id: result.insertedId
    };
  } catch (error) {
    console.error('Error creating invitation:', error);
    
    // Handle duplicate key errors
    if (error.code === 11000) {
      if (error.message.includes('email')) {
        throw new Error('An invitation has already been sent to this email address');
      }
      if (error.message.includes('token')) {
        throw new Error('Token collision occurred, please try again');
      }
    }
    
    throw new Error(`Failed to create invitation: ${error.message}`);
  }
}

/**
 * Finds an invitation by token
 * @param {string} token - Invitation token
 * @returns {Promise<Object|null>} Invitation document or null
 */
export async function findInvitationByToken(token) {
  try {
    const collection = await getCollection(COLLECTIONS.INVITATIONS);
    return await collection.findOne({ token });
  } catch (error) {
    console.error('Error finding invitation by token:', error);
    throw new Error(`Failed to find invitation: ${error.message}`);
  }
}

/**
 * Finds an invitation by email and organization
 * @param {string} email - Email address
 * @param {ObjectId} organizationId - Organization ID
 * @returns {Promise<Object|null>} Invitation document or null
 */
export async function findInvitationByEmail(email, organizationId) {
  try {
    const collection = await getCollection(COLLECTIONS.INVITATIONS);
    return await collection.findOne({ 
      email: email.toLowerCase().trim(),
      organizationId: new ObjectId(organizationId)
    });
  } catch (error) {
    console.error('Error finding invitation by email:', error);
    throw new Error(`Failed to find invitation: ${error.message}`);
  }
}

/**
 * Gets invitations for an organization with optional filtering
 * @param {ObjectId} organizationId - Organization ID
 * @param {Object} filters - Optional filters
 * @param {Object} pagination - Pagination options
 * @returns {Promise<Object>} Invitations and metadata
 */
export async function getInvitationsForOrganization(organizationId, filters = {}, pagination = {}) {
  try {
    const collection = await getCollection(COLLECTIONS.INVITATIONS);
    
    // Build query
    const query = {
      organizationId: new ObjectId(organizationId),
      ...filters
    };

    // Build sort options (newest first)
    const sort = { createdAt: -1 };

    // Apply pagination
    const { skip = 0, limit = 20 } = pagination;

    // Execute queries
    const [invitations, totalCount] = await Promise.all([
      collection.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .toArray(),
      collection.countDocuments(query)
    ]);

    return {
      invitations,
      totalCount,
      hasMore: skip + invitations.length < totalCount
    };
  } catch (error) {
    console.error('Error getting invitations for organization:', error);
    throw new Error(`Failed to get invitations: ${error.message}`);
  }
}

/**
 * Updates an invitation status
 * @param {ObjectId} invitationId - Invitation ID
 * @param {string} status - New status
 * @param {Object} additionalData - Additional data to update
 * @returns {Promise<Object>} Update result
 */
export async function updateInvitationStatus(invitationId, status, additionalData = {}) {
  try {
    const collection = await getCollection(COLLECTIONS.INVITATIONS);
    
    const updateData = {
      status,
      ...additionalData
    };

    // Add acceptance timestamp if accepting
    if (status === INVITATION_STATUS.ACCEPTED) {
      updateData.acceptedAt = new Date();
    }

    const result = await collection.updateOne(
      { _id: new ObjectId(invitationId) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      throw new Error('Invitation not found');
    }

    return result;
  } catch (error) {
    console.error('Error updating invitation status:', error);
    throw new Error(`Failed to update invitation: ${error.message}`);
  }
}

/**
 * Marks expired invitations
 * @param {Date} referenceDate - Date to compare against (defaults to now)
 * @returns {Promise<number>} Number of invitations marked as expired
 */
export async function markExpiredInvitations(referenceDate = new Date()) {
  try {
    const collection = await getCollection(COLLECTIONS.INVITATIONS);
    
    const result = await collection.updateMany(
      {
        status: INVITATION_STATUS.PENDING,
        expiresAt: { $lt: referenceDate }
      },
      {
        $set: { status: INVITATION_STATUS.EXPIRED }
      }
    );

    return result.modifiedCount;
  } catch (error) {
    console.error('Error marking expired invitations:', error);
    throw new Error(`Failed to mark expired invitations: ${error.message}`);
  }
}

/**
 * Deletes old expired invitations (cleanup)
 * @param {number} daysOld - Delete invitations expired for this many days
 * @returns {Promise<number>} Number of invitations deleted
 */
export async function deleteOldExpiredInvitations(daysOld = 30) {
  try {
    const collection = await getCollection(COLLECTIONS.INVITATIONS);
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);
    
    const result = await collection.deleteMany({
      status: INVITATION_STATUS.EXPIRED,
      expiresAt: { $lt: cutoffDate }
    });

    return result.deletedCount;
  } catch (error) {
    console.error('Error deleting old expired invitations:', error);
    throw new Error(`Failed to delete old invitations: ${error.message}`);
  }
}

/**
 * Creates a new team member in the database
 * @param {Object} memberDocument - Formatted team member document
 * @returns {Promise<Object>} Created team member with ID
 */
export async function createTeamMember(memberDocument) {
  try {
    const collection = await getCollection(COLLECTIONS.MEMBERS);
    const result = await collection.insertOne(memberDocument);
    
    return {
      ...memberDocument,
      _id: result.insertedId
    };
  } catch (error) {
    console.error('Error creating team member:', error);
    
    // Handle duplicate key errors
    if (error.code === 11000) {
      throw new Error('This user is already a member of this organization');
    }
    
    throw new Error(`Failed to create team member: ${error.message}`);
  }
}

/**
 * Finds a team member by user ID and organization
 * @param {ObjectId} userId - User ID
 * @param {ObjectId} organizationId - Organization ID
 * @returns {Promise<Object|null>} Team member document or null
 */
export async function findTeamMember(userId, organizationId) {
  try {
    const collection = await getCollection(COLLECTIONS.MEMBERS);
    return await collection.findOne({ 
      userId: new ObjectId(userId),
      organizationId: new ObjectId(organizationId)
    });
  } catch (error) {
    console.error('Error finding team member:', error);
    throw new Error(`Failed to find team member: ${error.message}`);
  }
}

/**
 * Checks if a user exists as a team member by email
 * @param {string} email - Email address
 * @param {ObjectId} organizationId - Organization ID
 * @returns {Promise<boolean>} True if user is already a team member
 */
export async function isExistingTeamMember(email, organizationId) {
  try {
    // Get users collection to find user by email
    const usersCollection = await getCollection('users');
    const user = await usersCollection.findOne({ 
      email: email.toLowerCase().trim() 
    });

    if (!user) {
      return false;
    }

    // Check if user is already a team member
    const teamMember = await findTeamMember(user._id, organizationId);
    return !!teamMember;
  } catch (error) {
    console.error('Error checking existing team member:', error);
    throw new Error(`Failed to check team member status: ${error.message}`);
  }
}

/**
 * Gets team members for an organization with optional filtering
 * @param {ObjectId} organizationId - Organization ID
 * @param {Object} filters - Optional filters
 * @param {Object} pagination - Pagination options
 * @returns {Promise<Object>} Team members and metadata
 */
export async function getTeamMembersForOrganization(organizationId, filters = {}, pagination = {}) {
  try {
    const collection = await getCollection(COLLECTIONS.MEMBERS);
    
    // Build query
    const query = {
      organizationId: new ObjectId(organizationId),
      ...filters
    };

    // Build sort options (newest first)
    const sort = { joinedAt: -1 };

    // Apply pagination
    const { skip = 0, limit = 20 } = pagination;

    // Execute queries
    const [members, totalCount] = await Promise.all([
      collection.find(query)
        .sort(sort)
        .skip(skip)
        .limit(limit)
        .toArray(),
      collection.countDocuments(query)
    ]);

    return {
      members,
      totalCount,
      hasMore: skip + members.length < totalCount
    };
  } catch (error) {
    console.error('Error getting team members for organization:', error);
    throw new Error(`Failed to get team members: ${error.message}`);
  }
}

/**
 * Updates a team member's information
 * @param {ObjectId} memberId - Team member ID
 * @param {Object} updateData - Data to update
 * @returns {Promise<Object>} Update result
 */
export async function updateTeamMember(memberId, updateData) {
  try {
    const collection = await getCollection(COLLECTIONS.MEMBERS);
    
    const result = await collection.updateOne(
      { _id: new ObjectId(memberId) },
      { 
        $set: {
          ...updateData,
          'metadata.updatedAt': new Date()
        }
      }
    );

    if (result.matchedCount === 0) {
      throw new Error('Team member not found');
    }

    return result;
  } catch (error) {
    console.error('Error updating team member:', error);
    throw new Error(`Failed to update team member: ${error.message}`);
  }
}

/**
 * Updates team member's last active timestamp
 * @param {ObjectId} userId - User ID
 * @param {ObjectId} organizationId - Organization ID
 * @returns {Promise<Object>} Update result
 */
export async function updateMemberLastActive(userId, organizationId) {
  try {
    const collection = await getCollection(COLLECTIONS.MEMBERS);
    
    const result = await collection.updateOne(
      { 
        userId: new ObjectId(userId),
        organizationId: new ObjectId(organizationId)
      },
      { 
        $set: {
          'metadata.lastActiveAt': new Date(),
          'metadata.updatedAt': new Date()
        }
      }
    );

    return result;
  } catch (error) {
    console.error('Error updating member last active:', error);
    // Don't throw error for this operation as it's not critical
    return null;
  }
}

/**
 * Removes a team member (soft delete by setting inactive)
 * @param {ObjectId} memberId - Team member ID
 * @returns {Promise<Object>} Update result
 */
export async function removeTeamMember(memberId) {
  try {
    const collection = await getCollection(COLLECTIONS.MEMBERS);
    
    const result = await collection.updateOne(
      { _id: new ObjectId(memberId) },
      { 
        $set: {
          status: MEMBER_STATUS.INACTIVE,
          'metadata.isActive': false,
          'metadata.updatedAt': new Date()
        }
      }
    );

    if (result.matchedCount === 0) {
      throw new Error('Team member not found');
    }

    return result;
  } catch (error) {
    console.error('Error removing team member:', error);
    throw new Error(`Failed to remove team member: ${error.message}`);
  }
}

/**
 * Gets invitation and team member statistics for an organization
 * @param {ObjectId} organizationId - Organization ID
 * @returns {Promise<Object>} Statistics object
 */
export async function getTeamStatistics(organizationId) {
  try {
    const [invitationsCollection, membersCollection] = await Promise.all([
      getCollection(COLLECTIONS.INVITATIONS),
      getCollection(COLLECTIONS.MEMBERS)
    ]);

    const orgId = new ObjectId(organizationId);

    // Get invitation statistics
    const invitationStats = await invitationsCollection.aggregate([
      { $match: { organizationId: orgId } },
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 }
        }
      }
    ]).toArray();

    // Get team member statistics
    const memberStats = await membersCollection.aggregate([
      { $match: { organizationId: orgId } },
      {
        $group: {
          _id: '$role',
          count: { $sum: 1 }
        }
      }
    ]).toArray();

    // Format statistics
    const invitations = {};
    invitationStats.forEach(stat => {
      invitations[stat._id] = stat.count;
    });

    const members = {};
    memberStats.forEach(stat => {
      members[stat._id] = stat.count;
    });

    // Get total counts
    const [totalInvitations, totalMembers] = await Promise.all([
      invitationsCollection.countDocuments({ organizationId: orgId }),
      membersCollection.countDocuments({ organizationId: orgId, 'metadata.isActive': true })
    ]);

    return {
      invitations: {
        ...invitations,
        total: totalInvitations
      },
      members: {
        ...members,
        total: totalMembers
      }
    };
  } catch (error) {
    console.error('Error getting team statistics:', error);
    throw new Error(`Failed to get team statistics: ${error.message}`);
  }
}