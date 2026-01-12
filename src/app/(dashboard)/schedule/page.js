'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, Clock, Video, MoreVertical, Calendar as CalendarIcon, Users as UsersIcon } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, Button, Badge } from '@/components/ui/common';

export default function SchedulePage() {
    const router = useRouter();
    const [interviews, setInterviews] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchInterviews();
        fetchTodayStats();
    }, []);

    const fetchInterviews = async () => {
        try {
            const response = await fetch('/api/interviews?sortBy=date&sortOrder=asc&limit=20');
            if (!response.ok) {
                throw new Error('Failed to fetch interviews');
            }
            const data = await response.json();
            
            // Ensure interviews is always an array
            const interviewsArray = Array.isArray(data.interviews) ? data.interviews : [];
            setInterviews(interviewsArray);
        } catch (err) {
            console.error('Error fetching interviews:', err);
            setError('Failed to load interviews');
            setInterviews([]); // Ensure interviews is set to empty array on error
        }
    };

    const fetchTodayStats = async () => {
        try {
            const today = new Date().toISOString().split('T')[0];
            const response = await fetch(`/api/interviews/stats?date=${today}`);
            if (!response.ok) {
                throw new Error('Failed to fetch stats');
            }
            const data = await response.json();
            setStats(data.stats);
        } catch (err) {
            console.error('Error fetching stats:', err);
        } finally {
            setLoading(false);
        }
    };

    if (loading) {
        return (
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Interview Schedule</h2>
                        <p className="text-muted-foreground text-sm sm:text-base">Loading interviews...</p>
                    </div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Interview Schedule</h2>
                        <p className="text-red-500 text-sm sm:text-base">{error}</p>
                    </div>
                    <Button onClick={() => router.push('/schedule/new')} className="w-full sm:w-auto">
                        <CalendarIcon className="h-4 w-4 mr-2" />
                        Schedule Interview
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Interview Schedule</h2>
                    <p className="text-muted-foreground text-sm sm:text-base">Upcoming interviews and events</p>
                </div>
                <Button onClick={() => router.push('/schedule/new')} className="w-full sm:w-auto">
                    <CalendarIcon className="h-4 w-4 mr-2" />
                    Schedule Interview
                </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-4">
                    <h3 className="font-medium text-lg">Upcoming</h3>
                    {Array.isArray(interviews) && interviews.length === 0 ? (
                        <Card>
                            <CardContent className="p-8 text-center">
                                <p className="text-muted-foreground">No interviews scheduled yet.</p>
                                <Button 
                                    onClick={() => router.push('/schedule/new')} 
                                    className="mt-4"
                                >
                                    Schedule Your First Interview
                                </Button>
                            </CardContent>
                        </Card>
                    ) : (
                        Array.isArray(interviews) && interviews.map(interview => (
                            <Card key={interview.id} className="hover:border-primary/50 transition-colors">
                                <CardContent className="p-4">
                                    <div className="flex flex-col sm:flex-row items-start gap-4">
                                        <div className="flex sm:flex-col items-center justify-center flex-shrink-0 w-full sm:w-16 h-12 sm:h-16 bg-primary/10 rounded-lg text-primary gap-2 sm:gap-0">
                                            <span className="text-xs sm:text-sm font-medium">{new Date(interview.date).toLocaleString('default', { month: 'short' }).toUpperCase()}</span>
                                            <span className="text-xl sm:text-2xl font-bold">{new Date(interview.date).getDate()}</span>
                                        </div>

                                        <div className="flex-1 min-w-0 w-full">
                                            <div className="flex justify-between items-start gap-2">
                                                <div className="min-w-0">
                                                    <h4 className="font-semibold text-base sm:text-lg truncate">{interview.candidateName}</h4>
                                                    <p className="text-xs sm:text-sm text-muted-foreground truncate">{interview.jobTitle}</p>
                                                </div>
                                                <Badge variant="secondary" className="flex-shrink-0">{interview.type}</Badge>
                                            </div>

                                            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-xs sm:text-sm text-muted-foreground">
                                                <div className="flex items-center gap-1.5">
                                                    <Clock className="h-4 w-4" />
                                                    {interview.time} ({interview.duration})
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <Video className="h-4 w-4" />
                                                    {interview.meetingDetails?.type || interview.type}
                                                </div>
                                                <div className="flex items-center gap-1.5">
                                                    <UsersIcon className="h-4 w-4" />
                                                    <span className="truncate">{interview.interviewers?.join(', ') || 'TBD'}</span>
                                                </div>
                                            </div>
                                        </div>

                                        <Button variant="ghost" size="icon" className="hidden sm:flex h-8 w-8 flex-shrink-0">
                                            <MoreVertical className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </CardContent>
                            </Card>
                        ))
                    )}
                </div>

                <div className="space-y-6">
                    <Card>
                        <CardHeader>
                            <CardTitle>Quick Actions</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-2">
                            <Button variant="outline" className="w-full justify-start">Send Availability Request</Button>
                            <Button variant="outline" className="w-full justify-start">Sync Calendar</Button>
                            <Button variant="outline" className="w-full justify-start">Configure Interview Templates</Button>
                        </CardContent>
                    </Card>

                    <Card className="bg-gradient-to-br from-primary to-blue-600 text-primary-foreground border-none">
                        <CardHeader>
                            <CardTitle className="text-white">Daily Summary</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="text-4xl font-bold text-white mb-2">
                                {stats?.totalInterviews || 0}
                            </div>
                            <p className="text-blue-100">Interviews scheduled for today.</p>
                            {stats?.interviewerInitials && stats.interviewerInitials.length > 0 && (
                                <div className="mt-4 pt-4 border-t border-blue-400/30 flex gap-2">
                                    {stats.interviewerInitials.slice(0, 3).map((initials, index) => (
                                        <div key={index} className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-xs font-medium">
                                            {initials}
                                        </div>
                                    ))}
                                    {stats.interviewerInitials.length > 3 && (
                                        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-xs font-medium">
                                            +{stats.interviewerInitials.length - 3}
                                        </div>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
}
