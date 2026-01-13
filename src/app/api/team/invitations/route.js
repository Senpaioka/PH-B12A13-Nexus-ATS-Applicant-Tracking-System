/**
 * Team Invitations API
 * Handles team member invitation creation and retrieval
 */

import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { ObjectId } from 'mongodb';
import { 
  createInvitationDocument,
  TEAM_ROLES,
  hasPermission,
  formatInvitationForDisplay
} from '@/lib/team/invitation-models.js';
import {
  validateInvitationData,
  validateInvitationPermissions,
  sanitizeInvitationInput,
  validatePaginationParams,
  validateInvitationFilters,
  ValidationError
} from '@/lib/team/invitation-validation.js';
import {
  createInvitation,
  getInvitationsForOrganization,
  findInvitationByEmail,
  isExistingTeamMember,
  markExpiredInvitations,
  initializeTeamCollections
} from '@/lib/team/invitation-db.js';
import {
  sendValidatedInvitationEmail,
  formatInvitationEmailError
} from '@/lib/email/invitation-email-service.js';
import { getCollection } from '@/lib/mongodb.js';

/**
 * POST /api/team/invitations - Create new team member invitation
 */
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Initialize team collections
    await initializeTeamCollections();

    const body = await request.json();
    
    // Get user information to check permissions
    const usersCollection = await getCollection('users');
    const user = await usersCollection.findOne({ _id: new ObjectId(session.user.id) });
    
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // For now, we'll assume the user's organization is their user ID
    // In a real system, this would come from a proper organization structure
    const organizationId = session.user.id;
    const userRole = user.role || 'user';

    // Check if user has admin permissions (only admins can invite)
    // For now, we'll check if user role is 'admin' or if they're the organization owner
    const isAdmin = userRole === 'admin' || user._id.toString() === organizationId;
    
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Only administrators can invite team members' },
        { status: 403 }
      );
    }

    // Sanitize input
    const sanitizedInput = sanitizeInvitationInput(body);

    // Prepare invitation data
    const invitationData = {
      organizationId,
      email: sanitizedInput.email,
      role: sanitizedInput.role,
      invitedBy: session.user.id,
      message: sanitizedInput.message,
      inviterName: user.name || session.user.name,
      inviterEmail: user.email || session.user.email,
      organizationName: user.organizationName || 'Nexus ATS',
      ipAddress: request.headers.get('x-forwarded-for') || 
                 request.headers.get('x-real-ip') || 
                 'unknown',
      userAgent: request.headers.get('user-agent') || 'unknown'
    };

    // Validate invitation data
    try {
      validateInvitationData(invitationData);
    } catch (validationError) {
      console.error('Validation error:', validationError.message);
      
      if (validationError.name === 'ValidationError' && validationError.field) {
        const errorDetails = Array.isArray(validationError.field) 
          ? validationError.field.map(err => `${err.field}: ${err.message}`).join('; ')
          : validationError.message;
        
        return NextResponse.json(
          { error: 'Validation failed', details: errorDetails },
          { status: 400 }
        );
      }
      
      return NextResponse.json(
        { error: 'Validation failed', details: validationError.message },
        { status: 400 }
      );
    }

    // Validate permissions (admin-only invitations)
    try {
      validateInvitationPermissions(TEAM_ROLES.ADMIN, invitationData.role);
    } catch (permissionError) {
      return NextResponse.json(
        { error: permissionError.message },
        { status: 403 }
      );
    }

    // Check if email is already a team member
    const isExistingMember = await isExistingTeamMember(invitationData.email, organizationId);
    if (isExistingMember) {
      return NextResponse.json(
        { error: 'This email is already a team member' },
        { status: 409 }
      );
    }

    // Check if there's already a pending invitation
    const existingInvitation = await findInvitationByEmail(invitationData.email, organizationId);
    if (existingInvitation && existingInvitation.status === 'pending') {
      return NextResponse.json(
        { error: 'An invitation has already been sent to this email address' },
        { status: 409 }
      );
    }

    // Create invitation document
    const invitationDocument = createInvitationDocument(invitationData);

    // Save to database
    const createdInvitation = await createInvitation(invitationDocument);

    // Format for response
    const formattedInvitation = formatInvitationForDisplay(createdInvitation);

    // Send invitation email
    let emailResult = null;
    try {
      emailResult = await sendValidatedInvitationEmail(createdInvitation);
      console.log(`✅ Invitation email sent successfully to ${invitationData.email}`);
    } catch (emailError) {
      console.error('⚠️ Failed to send invitation email:', emailError);
      // Don't fail the entire request if email fails - invitation is still created
      // In production, you might want to queue this for retry
    }

    return NextResponse.json({
      success: true,
      data: formattedInvitation,
      emailSent: !!emailResult,
      emailResult: emailResult ? {
        messageId: emailResult.messageId,
        previewUrl: emailResult.previewUrl
      } : null
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating invitation:', error);
    
    // Handle specific database errors
    if (error.message.includes('already been sent')) {
      return NextResponse.json(
        { error: error.message },
        { status: 409 }
      );
    }
    
    if (error.message.includes('Token collision')) {
      return NextResponse.json(
        { error: 'Please try again' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create invitation' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/team/invitations - Retrieve team invitations for current organization
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

    // Check if user has admin permissions (only admins can view invitations)
    const isAdmin = userRole === 'admin' || user._id.toString() === organizationId;
    
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'Only administrators can view team invitations' },
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
    const filters = validateInvitationFilters({
      status: searchParams.get('status'),
      role: searchParams.get('role')
    });

    // Mark expired invitations before retrieving
    await markExpiredInvitations();

    // Get invitations
    const result = await getInvitationsForOrganization(
      organizationId,
      filters,
      paginationParams
    );

    // Format invitations for display
    const formattedInvitations = result.invitations.map(formatInvitationForDisplay);

    return NextResponse.json({
      success: true,
      data: formattedInvitations,
      pagination: {
        page: paginationParams.page,
        limit: paginationParams.limit,
        total: result.totalCount,
        hasMore: result.hasMore
      }
    });

  } catch (error) {
    console.error('Error fetching invitations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch invitations' },
      { status: 500 }
    );
  }
}