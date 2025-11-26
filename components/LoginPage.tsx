import React, { useState } from 'react';
import { authService } from '../services/authService';
import { LogoIcon, GoogleIcon, AdminIcon } from './Icons';
import { PlatformSettings, UserRole } from '../types';
import StaffLoginModal from './StaffLoginModal';

interface LoginPageProps {
    platformSettings: PlatformSettings;
}

const LoginPage: React.FC<LoginPageProps> = ({ platformSettings }) => {
    const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showStaffLogin, setShowStaffLogin] = useState(false);

    // Form Fields
    const [identifier, setIdentifier] = useState(''); // Email or Mobile for login
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    
    // Signup specific
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [role, setRole] = useState<UserRole>('brand');
    const [companyName, setCompanyName] = useState('');
    const [mobileNumber, setMobileNumber] = useState('');
    const [referralCode, setReferralCode] = useState('');

    const resetFormFields = () => {
        setIdentifier('');
        setPassword('');
        setConfirmPassword('');
        setEmail('');
        setName('');
        setRole('brand');
        setCompanyName('');
        setMobileNumber('');
        setReferralCode('');
        setError(null);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        try {
            if (authMode === 'login') {
                await authService.login(identifier, password);
            } else {
                if (password !== confirmPassword) {
                    throw new Error("Passwords do not match.");
                }
                await authService.register(email, password, role, name, companyName, mobileNumber, referralCode);
            }
        } catch (err: any) {
            setError(err.message || "Authentication failed.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setError(null);
        try {
            await authService.signInWithGoogle(role);
        } catch (err: any) {
            setError(err.message || "Google sign-in failed.");
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
            <div className="max-w-md w-full space-y-8 bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl">
                <div className="text-center">
                    <LogoIcon className="mx-auto h-12 w-auto" />
                    <h2 className="mt-6 text-3xl font-extrabold text-gray-900 dark:text-white">
                        {authMode === 'login' ? 'Sign in to your account' : 'Create your account'}
                    </h2>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        {platformSettings.welcomeMessage || "Welcome to BIGYAPON"}
                    </p>
                </div>

                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    {error && (
                        <div className="bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 p-4">
                            <p className="text-sm text-red-700 dark:text-red-300">{error}</p>
                        </div>
                    )}

                    <div className="rounded-md shadow-sm space-y-4">
                        {authMode === 'login' ? (
                            <>
                                <div>
                                    <label htmlFor="identifier" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                        Email or Mobile Number
                                    </label>
                                    <input
                                        id="identifier"
                                        name="identifier"
                                        type="text"
                                        required
                                        className="mt-1 appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm dark:bg-gray-700"
                                        placeholder="user@example.com or 9876543210"
                                        value={identifier}
                                        onChange={(e) => setIdentifier(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                        Password
                                    </label>
                                    <input
                                        id="password"
                                        name="password"
                                        type="password"
                                        required
                                        className="mt-1 appearance-none rounded-md relative block w-full px-3 py-2 border border-gray-300 dark:border-gray-600 placeholder-gray-500 dark:placeholder-gray-400 text-gray-900 dark:text-white focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm dark:bg-gray-700"
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                    />
                                </div>
                            </>
                        ) : (
                            <>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">I am a...</label>
                                    <select
                                        value={role}
                                        onChange={(e) => setRole(e.target.value as UserRole)}
                                        className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                    >
                                        <option value="brand">Brand (Looking for Influencers)</option>
                                        <option value="influencer">Influencer (Content Creator)</option>
                                        <option value="livetv">Live TV Channel</option>
                                        <option value="banneragency">Banner Ad Agency</option>
                                    </select>
                                </div>
                                <div>
                                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Full Name</label>
                                    <input
                                        id="name"
                                        type="text"
                                        required
                                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                        value={name}
                                        onChange={(e) => setName(e.target.value)}
                                    />
                                </div>
                                {role !== 'influencer' && (
                                    <div>
                                        <label htmlFor="companyName" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                            {role === 'livetv' ? 'Channel Name' : 'Company Name'}
                                        </label>
                                        <input
                                            id="companyName"
                                            type="text"
                                            required
                                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                            value={companyName}
                                            onChange={(e) => setCompanyName(e.target.value)}
                                        />
                                    </div>
                                )}
                                <div>
                                    <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email Address</label>
                                    <input
                                        id="email"
                                        type="email"
                                        required
                                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label htmlFor="mobileNumber" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Mobile Number</label>
                                    <input
                                        id="mobileNumber"
                                        type="tel"
                                        required
                                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                        value={mobileNumber}
                                        onChange={(e) => setMobileNumber(e.target.value)}
                                        placeholder="10-digit number"
                                    />
                                </div>
                                <div>
                                    <label htmlFor="signup-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
                                    <input
                                        id="signup-password"
                                        type="password"
                                        required
                                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Confirm Password</label>
                                    <input
                                        id="confirm-password"
                                        type="password"
                                        required
                                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                        value={confirmPassword}
                                        onChange={(e) => setConfirmPassword(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label htmlFor="referralCode" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Referral Code (Optional)</label>
                                    <input
                                        id="referralCode"
                                        type="text"
                                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                        value={referralCode}
                                        onChange={(e) => setReferralCode(e.target.value)}
                                    />
                                </div>
                            </>
                        )}
                    </div>

                    <div>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                        >
                            {isLoading ? 'Processing...' : authMode === 'login' ? 'Sign in' : 'Sign up'}
                        </button>
                    </div>

                    <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                            <div className="w-full border-t border-gray-300 dark:border-gray-600" />
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-2 bg-white dark:bg-gray-800 text-gray-500">Or continue with</span>
                        </div>
                    </div>

                    <div>
                        <button
                            type="button"
                            onClick={handleGoogleLogin}
                            className="w-full flex justify-center items-center py-2 px-4 border border-gray-300 rounded-md shadow-sm bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-600"
                        >
                            <GoogleIcon className="h-5 w-5 mr-2" />
                            Google
                        </button>
                    </div>
                </form>

                <div className="text-center text-sm text-gray-600 mt-4 dark:text-gray-400">
                    {authMode === 'login' ? (
                        <>
                            Don't have an account?{' '}
                            <button
                                type="button"
                                onClick={() => {
                                    setAuthMode('signup');
                                    resetFormFields();
                                }}
                                className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
                            >
                                Create Account
                            </button>
                        </>
                    ) : (
                        <>
                            Already have an account?{' '}
                            <button
                                type="button"
                                onClick={() => {
                                    setAuthMode('login');
                                    resetFormFields();
                                }}
                                className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300"
                            >
                                Log In
                            </button>
                        </>
                    )}
                </div>

                <div className="mt-6 text-center">
                    <button
                        onClick={() => setShowStaffLogin(true)}
                        className="text-sm text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 flex items-center justify-center w-full"
                    >
                        <AdminIcon className="w-4 h-4 mr-1" /> Staff Login
                    </button>
                </div>
            </div>

            {showStaffLogin && (
                <StaffLoginModal 
                    onClose={() => setShowStaffLogin(false)} 
                    platformSettings={platformSettings}
                />
            )}
        </div>
    );
};

export default LoginPage;