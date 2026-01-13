/**
 * Team Members API
 * Handles team member retrieval and management
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { ObjectId } from 'mongodb';
import { 
  TEAM_ROLES,
  MEMBER_STATUS,
  formatTeamMemberForDisplay
} from '@/lib/team/invitation-models.js';
import {
  validatePaginationParams,
  validateTeamMemberFilters,
  ValidationError
} from '@/lib/team/invitation-validation.js';
import {
  getTeamMembersForOrganization,
  initializeTeamCollections
} from '@/lib/team/invitation-db.js';
import { getCollection } from '@/lib/mongodb.js';

/**
 * GET /api/team/members - Retrieve team members for current organization
 */
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Initialize team collections
    await initializeTeamCollections();

    // Get user information to check permissions
    const usersCollection = await getCollection('users');
    const user = await usersCollection.findOne({ _id: new ObjectId(session.user.id) });
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // For now, we'll assume the user's organization is their user ID
    const organizationId = session.user.id;
    const userRole = user.role || 'user';

    // Check if user has admin permissions (only admins can view team members)
    const isAdmin = userRole === 'admin' || user._id.toString() === organizationId;
    
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Only administrators can view team members' },
        { status: 403 }
      );
    }

    // Parse query parameters
    const { searchParams } = new URL(request.url);
    
    // Pagination
    const paginationParams = validatePaginationParams({
      page: searchParams.get('page'),
      limit: searchParams.get('limit')
    });

    // Filters
    const filters = validateTeamMemberFilters({
      status: searchParams.get('status'),
      role: searchParams.get('role')
    });

    // Get team members
    const result = await getTeamMembersForOrganization(
      organizationId,
      filters,
      paginationParams
    );

    // Format team members for display
    const formattedMembers = result.members.map(formatTeamMemberForDisplay);

    return NextResponse.json({
      success: true,
      data: formattedMembers,
      pagination: {
        page: paginationParams.page,
        limit: paginationParams.limit,
        total: result.totalCount,
        hasMore: result.hasMore
      }
    });

  } catch (error) {
    console.error('Error fetching team members:', error);
    return NextResponse.json(
      { error: 'Failed to fetch team members' },
      { status: 500 }
    );
  }
}