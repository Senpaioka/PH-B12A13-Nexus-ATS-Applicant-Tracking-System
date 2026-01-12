import { NextResponse } from 'next/server';
import { InterviewService } from '@/lib/interviews/interview-service';
import { validateInterviewData } from '@/lib/interviews/interview-validation';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

const interviewService = new InterviewService();

/**
 * GET /api/interviews - Retrieve interviews with optional filtering and sorting
 */
export async function GET(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Initialize service
    await interviewService.initialize();

    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const sortBy = searchParams.get('sortBy') || 'date';
    const sortOrder = searchParams.get('sortOrder') || 'asc';
    const limit = parseInt(searchParams.get('limit')) || 50;

    let interviews;
    if (date) {
      // Get interviews for specific date
      interviews = await interviewService.getInterviewsByDate(new Date(date));
    } else {
      // Get all interviews with sorting and pagination
      const result = await interviewService.getAllInterviews(
        {}, // filters
        { limit } // pagination
      );
      interviews = result.interviews;
    }

    return NextResponse.json({ interviews });
  } catch (error) {
    console.error('Error fetching interviews:', error);
    return NextResponse.json(
      { error: 'Failed to fetch interviews' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/interviews - Create a new interview
 */
export async function POST(request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Initialize service
    await interviewService.initialize();

    const body = await request.json();
    
    // Validate input
    try {
      validateInterviewData(body);
    } catch (validationError) {
      console.error('Validation error:', validationError.message);
      
      // Handle ValidationError with field details
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

    // Create interview
    const interview = await interviewService.createInterview(body, session.user.id);

    return NextResponse.json({ interview }, { status: 201 });
  } catch (error) {
    console.error('Error creating interview:', error);
    
    if (error.name === 'InterviewServiceError') {
      return NextResponse.json(
        { error: error.message },
        { status: error.statusCode || 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create interview' },
      { status: 500 }
    );
  }
}