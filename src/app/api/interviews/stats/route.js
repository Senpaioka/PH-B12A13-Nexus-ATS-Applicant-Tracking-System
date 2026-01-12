import { NextResponse } from 'next/server';
import { InterviewService } from '@/lib/interviews/interview-service';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';

const interviewService = new InterviewService();

/**
 * GET /api/interviews/stats - Get interview statistics for a specific date
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
    const dateParam = searchParams.get('date');
    
    // Default to today if no date provided
    const date = dateParam ? new Date(dateParam) : new Date();
    
    const stats = await interviewService.getInterviewStats(date);

    return NextResponse.json({ stats });
  } catch (error) {
    console.error('Error fetching interview stats:', error);
    return NextResponse.json(
      { error: 'Failed to fetch interview statistics' },
      { status: 500 }
    );
  }
}