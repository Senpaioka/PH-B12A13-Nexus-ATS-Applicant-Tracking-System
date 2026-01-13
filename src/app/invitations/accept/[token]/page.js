'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, signIn } from 'next-auth/react';
import {
    CheckCircle,
    XCircle,
    Loader2,
    Users,
    Mail,
    Building,
    AlertCircle,
    Clock
} from 'lucide-react';
import {
    Button,
    Card,
    CardContent,
    CardHeader,
    CardTitle
} from '@/components/ui/common';

export default function AcceptInvitationPage({ params }) {
    const router = useRouter();
    const { data: session, status: sessionStatus } = useSession();
    const [invitation, setInvitation] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isAccepting, setIsAccepting] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);
    const [token, setToken] = useState(null);

    useEffect(() => {
        // Unwrap params
        params.then(p => setToken(p.token));
    }, [params]);

    useEffect(() => {
        if (token) {
            loadInvitation();
        }
    }, [token]);

    const loadInvitation = async () => {
        setIsLoading(true);
        setError(null);

        try {
            const response = await fetch(`/api/invitations/accept/${token}`);
            const data = await response.json();

            if (data.success) {
                setInvitation(data.data);
            } else {
                if (data.expired) {
                    setError({ type: 'expired', message: data.error });
                } else if (data.alreadyAccepted) {
                    setError({ type: 'already_accepted', message: data.error });
                } else {
                    setError({ type: 'general', message: data.error || 'Invalid invitation' });
                }
            }
        } catch (error) {
            console.error('Error loading invitation:', error);
            setError({ type: 'general', message: 'Failed to load invitation. Please try again.' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleAcceptInvitation = async () => {
        // Check if user is logged in
        if (!session) {
            // Redirect to login with callback to this page
            signIn(undefined, {
                callbackUrl: `/invitations/accept/${token}`
            });
            return;
        }

        setIsAccepting(true);
        setError(null);

        try {
            const response = await fetch(`/api/invitations/accept/${token}`, {
                method: 'POST',
            });

            const data = await response.json();

            if (data.success) {
                setSuccess(true);
                // Redirect to dashboard after 2 seconds
                setTimeout(() => {
                    router.push('/');
                }, 2000);
            } else {
                if (data.requiresAuth) {
                    // Redirect to login
                    signIn(undefined, {
                        callbackUrl: `/invitations/accept/${token}`
                    });
                } else {
                    setError({ type: 'general', message: data.error || 'Failed to accept invitation' });
                }
            }
        } catch (error) {
            console.error('Error accepting invitation:', error);
            setError({ type: 'general', message: 'Failed to accept invitation. Please try again.' });
        } finally {
            setIsAccepting(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50">
                <div className="text-center">
                    <Loader2 className="h-12 w-12 animate-spin mx-auto text-blue-600" />
                    <p className="mt-4 text-gray-600">Loading invitation...</p>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                <Card className="max-w-md w-full">
                    <CardHeader>
                        <div className="flex items-center justify-center mb-4">
                            <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center">
                                {error.type === 'expired' ? (
                                    <Clock className="h-8 w-8 text-red-600" />
                                ) : (
                                    <XCircle className="h-8 w-8 text-red-600" />
                                )}
                            </div>
                        </div>
                        <CardTitle className="text-center">
                            {error.type === 'expired' ? 'Invitation Expired' :
                                error.type === 'already_accepted' ? 'Already Accepted' :
                                    'Invalid Invitation'}
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-center">
                            <p className="text-gray-600 mb-6">{error.message}</p>
                            <Button onClick={() => router.push('/')}>
                                Go to Dashboard
                            </Button>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (success) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
                <Card className="max-w-md w-full">
                    <CardHeader>
                        <div className="flex items-center justify-center mb-4">
                            <div className="h-16 w-16 rounded-full bg-green-100 flex items-center justify-center">
                                <CheckCircle className="h-8 w-8 text-green-600" />
                            </div>
                        </div>
                        <CardTitle className="text-center">Welcome to the Team!</CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="text-center">
                            <p className="text-gray-600 mb-4">
                                You have successfully joined the team.
                            </p>
                            <p className="text-sm text-gray-500">
                                Redirecting to dashboard...
                            </p>
                        </div>
                    </CardContent>
                </Card>
            </div>
        );
    }

    if (!invitation) {
        return null;
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
            <Card className="max-w-2xl w-full">
                <CardHeader>
                    <div className="flex items-center justify-center mb-4">
                        <div className="h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center">
                            <Users className="h-8 w-8 text-blue-600" />
                        </div>
                    </div>
                    <CardTitle className="text-center text-2xl">You're Invited!</CardTitle>
                    <p className="text-center text-gray-600 mt-2">
                        Join {invitation.organizationName || 'the team'} on Nexus ATS
                    </p>
                </CardHeader>
                <CardContent className="space-y-6">
                    {/* Invitation Details */}
                    <div className="bg-gray-50 rounded-lg p-6 space-y-4">
                        <div className="flex items-start gap-3">
                            <Building className="h-5 w-5 text-gray-400 mt-0.5" />
                            <div>
                                <p className="text-sm font-medium text-gray-700">Organization</p>
                                <p className="text-base text-gray-900">{invitation.organizationName || 'Nexus ATS'}</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3">
                            <Users className="h-5 w-5 text-gray-400 mt-0.5" />
                            <div>
                                <p className="text-sm font-medium text-gray-700">Role</p>
                                <p className="text-base text-gray-900">{invitation.role}</p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3">
                            <Mail className="h-5 w-5 text-gray-400 mt-0.5" />
                            <div>
                                <p className="text-sm font-medium text-gray-700">Invited by</p>
                                <p className="text-base text-gray-900">{invitation.inviterName || 'Team Administrator'}</p>
                            </div>
                        </div>

                        {invitation.message && (
                            <div className="mt-4 pt-4 border-t border-gray-200">
                                <p className="text-sm font-medium text-gray-700 mb-2">Personal Message</p>
                                <p className="text-sm text-gray-600 italic">"{invitation.message}"</p>
                            </div>
                        )}
                    </div>

                    {/* Expiry Notice */}
                    {
                        invitation.daysUntilExpiry !== undefined && invitation.daysUntilExpiry <= 3 && (
                            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
                                <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
                                <div>
                                    <p className="text-sm font-medium text-yellow-900">Invitation Expiring Soon</p>
                                    <p className="text-sm text-yellow-700">
                                        This invitation will expire in {invitation.daysUntilExpiry} day{invitation.daysUntilExpiry !== 1 ? 's' : ''}.
                                    </p>
                                </div>
                            </div>
                        )
                    }

                    {/* Actions */}
                    <div className="space-y-3">
                        {!session ? (
                            <>
                                <p className="text-sm text-gray-600 text-center">
                                    You need to sign in or create an account to accept this invitation.
                                </p>
                                <Button
                                    className="w-full"
                                    size="lg"
                                    onClick={handleAcceptInvitation}
                                    disabled={isAccepting}
                                >
                                    {isAccepting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Sign In to Accept Invitation
                                </Button>
                            </>
                        ) : (
                            <>
                                <p className="text-sm text-gray-600 text-center">
                                    Signed in as <span className="font-medium">{session.user.email}</span>
                                </p>
                                <Button
                                    className="w-full"
                                    size="lg"
                                    onClick={handleAcceptInvitation}
                                    disabled={isAccepting}
                                >
                                    {isAccepting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                                    Accept Invitation
                                </Button>
                            </>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="text-center pt-4">
                        <p className="text-xs text-gray-500">
                            By accepting this invitation, you agree to join the team and collaborate on Nexus ATS.
                        </p>
                    </div>
                </CardContent >
            </Card >
        </div >
    );
}
