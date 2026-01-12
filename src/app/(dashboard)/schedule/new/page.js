'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Save } from 'lucide-react';
import { Button, Input, Label, Card, CardContent, CardHeader, CardTitle, Select, Separator, Textarea } from '@/components/ui/common';

export default function ScheduleInterviewPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [candidates, setCandidates] = useState([]);
    const [jobs, setJobs] = useState([]);
    const [loadingData, setLoadingData] = useState(true);
    const [error, setError] = useState(null);
    const [formData, setFormData] = useState({
        candidateId: '',
        jobId: '',
        type: 'screening',
        interviewers: '',
        date: '2026-01-15', // Default to a future date
        time: '10:00', // Default to a valid business hour
        duration: 60,
        meetingType: 'video',
        meetingLink: '',
        location: '',
        notes: ''
    });

    useEffect(() => {
        fetchCandidatesAndJobs();
    }, []);

    const fetchCandidatesAndJobs = async () => {
        try {
            const [candidatesRes, jobsRes] = await Promise.all([
                fetch('/api/candidates').catch(err => ({ ok: false, error: err })),
                fetch('/api/jobs').catch(err => ({ ok: false, error: err }))
            ]);

            let candidates = [];
            let jobs = [];
            let errors = [];

            // Handle candidates response
            if (candidatesRes.ok) {
                try {
                    const candidatesData = await candidatesRes.json();
                    candidates = candidatesData.candidates || [];
                } catch (err) {
                    console.error('Error parsing candidates data:', err);
                    errors.push('Failed to load candidates');
                }
            } else {
                console.error('Candidates API failed:', candidatesRes.status);
                errors.push('Failed to load candidates');
            }

            // Handle jobs response
            if (jobsRes.ok) {
                try {
                    const jobsData = await jobsRes.json();
                    jobs = jobsData.jobs || [];
                } catch (err) {
                    console.error('Error parsing jobs data:', err);
                    errors.push('Failed to load jobs');
                }
            } else {
                console.error('Jobs API failed:', jobsRes.status);
                errors.push('Failed to load jobs');
            }

            setCandidates(candidates);
            setJobs(jobs);

            if (errors.length > 0) {
                setError(`Warning: ${errors.join(', ')}. You may need to refresh the page.`);
            }
        } catch (err) {
            console.error('Error fetching data:', err);
            setError('Failed to load candidates and jobs');
        } finally {
            setLoadingData(false);
        }
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);

        try {
            // Find selected candidate and job for names
            const selectedCandidate = candidates.find(c => (c.id || c._id) === formData.candidateId);
            const selectedJob = jobs.find(j => (j.id || j._id) === formData.jobId);

            if (!selectedCandidate || !selectedJob) {
                throw new Error('Please select both candidate and job');
            }

            const candidateFirstName = selectedCandidate.firstName || selectedCandidate.personalInfo?.firstName || 'Unknown';
            const candidateLastName = selectedCandidate.lastName || selectedCandidate.personalInfo?.lastName || 'Candidate';

            const interviewData = {
                candidateId: formData.candidateId,
                candidateName: `${candidateFirstName} ${candidateLastName}`,
                jobId: formData.jobId,
                jobTitle: selectedJob.title,
                date: formData.date,
                time: formData.time,
                type: formData.type,
                duration: parseInt(formData.duration),
                interviewers: formData.interviewers.split(',').map(name => name.trim()).filter(name => name),
                meetingType: formData.meetingType,
                meetingLink: formData.meetingLink || '',
                location: formData.location,
                notes: formData.notes
            };

            const response = await fetch('/api/interviews', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(interviewData),
            });

            if (!response.ok) {
                const errorData = await response.json();
                const error = new Error(errorData.error || 'Failed to create interview');
                error.details = errorData.details;
                throw error;
            }

            router.push('/schedule');
        } catch (err) {
            console.error('Error creating interview:', err);
            
            // Try to parse detailed validation errors
            if (err.message === 'Validation failed' && err.details) {
                setError(`Validation failed: ${err.details}`);
            } else {
                setError(err.message);
            }
        } finally {
            setIsLoading(false);
        }
    };

    if (loadingData) {
        return (
            <div className="space-y-6 max-w-3xl mx-auto pb-10">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => router.back()}>
                        <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div>
                        <h2 className="text-2xl font-bold tracking-tight">Schedule Interview</h2>
                        <p className="text-muted-foreground">Loading...</p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-3xl mx-auto pb-10">
            <div className="flex items-center gap-4">
                <Button variant="ghost" size="icon" onClick={() => router.back()}>
                    <ArrowLeft className="h-4 w-4" />
                </Button>
                <div>
                    <h2 className="text-2xl font-bold tracking-tight">Schedule Interview</h2>
                    <p className="text-muted-foreground">Set up a new interview with a candidate.</p>
                </div>
            </div>

            <form onSubmit={handleSubmit}>
                <Card>
                    <CardHeader>
                        <CardTitle>Interview Details</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-6">
                        {error && (
                            <div className="p-4 bg-red-50 border border-red-200 rounded-md">
                                <p className="text-red-600 text-sm">{error}</p>
                            </div>
                        )}

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="candidateId">Candidate</Label>
                                <Select 
                                    id="candidateId" 
                                    name="candidateId"
                                    value={formData.candidateId}
                                    onChange={handleInputChange}
                                    required
                                >
                                    <option value="">Select Candidate...</option>
                                    {candidates.map((c, index) => (
                                        <option key={c.id || c._id || `candidate-${index}`} value={c.id || c._id}>
                                            {c.firstName || c.personalInfo?.firstName} {c.lastName || c.personalInfo?.lastName} - {c.email || c.personalInfo?.email}
                                        </option>
                                    ))}
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="jobId">Job Position</Label>
                                <Select 
                                    id="jobId" 
                                    name="jobId"
                                    value={formData.jobId}
                                    onChange={handleInputChange}
                                    required
                                >
                                    <option value="">Select Job...</option>
                                    {jobs.map((j, index) => (
                                        <option key={j.id || j._id || `job-${index}`} value={j.id || j._id}>
                                            {j.title} - {j.department}
                                        </option>
                                    ))}
                                </Select>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="type">Interview Type</Label>
                                <Select 
                                    id="type" 
                                    name="type"
                                    value={formData.type}
                                    onChange={handleInputChange}
                                    required
                                >
                                    <option value="screening">Screening Call</option>
                                    <option value="technical">Technical Interview</option>
                                    <option value="cultural">Cultural Fit</option>
                                    <option value="final">Final Round</option>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="interviewers">Interviewers</Label>
                                <Input 
                                    id="interviewers" 
                                    name="interviewers"
                                    value={formData.interviewers}
                                    onChange={handleInputChange}
                                    placeholder="e.g. Alex Chen, Sarah Smith" 
                                    required 
                                />
                            </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="date">Date</Label>
                                <Input 
                                    id="date" 
                                    name="date"
                                    type="date" 
                                    value={formData.date}
                                    onChange={handleInputChange}
                                    required 
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="time">Time</Label>
                                <Input 
                                    id="time" 
                                    name="time"
                                    type="time" 
                                    value={formData.time}
                                    onChange={handleInputChange}
                                    required 
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="duration">Duration (minutes)</Label>
                                <Select 
                                    id="duration" 
                                    name="duration"
                                    value={formData.duration}
                                    onChange={handleInputChange}
                                    required
                                >
                                    <option value="30">30 minutes</option>
                                    <option value="45">45 minutes</option>
                                    <option value="60">60 minutes</option>
                                    <option value="90">90 minutes</option>
                                    <option value="120">120 minutes</option>
                                </Select>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="meetingType">Meeting Type</Label>
                            <Select 
                                id="meetingType" 
                                name="meetingType"
                                value={formData.meetingType}
                                onChange={handleInputChange}
                            >
                                <option value="video">Video Call (Google Meet/Zoom)</option>
                                <option value="phone">Phone Call</option>
                                <option value="in-person">In Person</option>
                            </Select>
                        </div>

                        {(formData.meetingType === 'video' || formData.meetingType === 'phone') && (
                            <div className="space-y-2">
                                <Label htmlFor="meetingLink">Meeting Link / Phone Number</Label>
                                <Input 
                                    id="meetingLink" 
                                    name="meetingLink"
                                    value={formData.meetingLink}
                                    onChange={handleInputChange}
                                    placeholder={formData.meetingType === 'video' ? 'https://zoom.us/j/... or https://meet.google.com/...' : '+1 (555) 123-4567'}
                                />
                            </div>
                        )}

                        {formData.meetingType === 'in-person' && (
                            <div className="space-y-2">
                                <Label htmlFor="location">Location</Label>
                                <Input 
                                    id="location" 
                                    name="location"
                                    value={formData.location}
                                    onChange={handleInputChange}
                                    placeholder="Conference Room A, 2nd Floor"
                                />
                            </div>
                        )}

                        <Separator />

                        <div className="space-y-2">
                            <Label htmlFor="notes">Notes for Interviewers</Label>
                            <Textarea 
                                id="notes" 
                                name="notes"
                                value={formData.notes}
                                onChange={handleInputChange}
                                placeholder="Add specific topics to cover or questions to ask..." 
                                className="min-h-[100px]" 
                            />
                        </div>

                        <div className="flex justify-end gap-4 pt-4">
                            <Button type="button" variant="outline" onClick={() => router.back()}>
                                Cancel
                            </Button>
                            <Button type="submit" disabled={isLoading}>
                                <Save className="mr-2 h-4 w-4" />
                                {isLoading ? 'Scheduling...' : 'Schedule Interview'}
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </form>
        </div>
    );
}
