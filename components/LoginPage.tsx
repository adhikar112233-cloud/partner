
import React, { useState, useRef, useEffect } from 'react';
import { authService } from '../services/authService';
import { LogoIcon, GoogleIcon, AdminIcon, ExclamationTriangleIcon } from './Icons';
import { PlatformSettings, UserRole } from '../types';
import StaffLoginModal from './StaffLoginModal';
import { RecaptchaVerifier } from 'firebase/auth';
import { auth } from '../services/firebase';

interface LoginPageProps {
    platformSettings: PlatformSettings;
}

const LoginPage: React.FC<LoginPageProps> = ({ platformSettings }) => {
    const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
    const [signupStep, setSignupStep] = useState<'form' | 'otp'>('form');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showStaffLogin, setShowStaffLogin] = useState(false);
    const [loginMethod, setLoginMethod] = useState<'otp' | 'password'>('otp');

    // Form Fields
    const [identifier, setIdentifier] = useState(''); // Email or Mobile for login
    const [password, setPassword] = useState('');
    const [otp, setOtp] = useState('');
    
    // Signup specific
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [role, setRole] = useState<UserRole>('brand');
    const [companyName, setCompanyName] = useState('');
    const [mobileNumber, setMobileNumber] = useState('');
    const [referralCode, setReferralCode] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    // Refs for Recaptcha
    const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);
    const recaptchaVerifierSignupRef = useRef<RecaptchaVerifier | null>(null);
    const confirmationResultRef = useRef<any>(null);

    // Cleanup Recaptcha on unmount
    useEffect(() => {
        return () => {
            if (recaptchaVerifierRef.current) {
                recaptchaVerifierRef.current.clear();
                recaptchaVerifierRef.current = null;
            }
            if (recaptchaVerifierSignupRef.current) {
                recaptchaVerifierSignupRef.current.clear();
                recaptchaVerifierSignupRef.current = null;
            }
        };
    }, []);

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
        setOtp('');
        setError(null);
        setSignupStep('form');
        // Clear existing recaptchas when switching modes
        if (recaptchaVerifierRef.current) {
            recaptchaVerifierRef.current.clear();
            recaptchaVerifierRef.current = null;
        }
        if (recaptchaVerifierSignupRef.current) {
            recaptchaVerifierSignupRef.current.clear();
            recaptchaVerifierSignupRef.current = null;
        }
        // Manually clear the containers to be safe
        const container1 = document.getElementById('recaptcha-container');
        if(container1) container1.innerHTML = '';
        const container2 = document.getElementById('recaptcha-container-signup');
        if(container2) container2.innerHTML = '';
    };

    // LOGIN: Send OTP
    const handleSendOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        
        // Basic validation for 10-digit mobile
        const cleanIdentifier = identifier.replace(/\D/g, '').slice(-10);
        if (cleanIdentifier.length !== 10) {
            setError("Please enter a valid 10-digit mobile number.");
            return;
        }

        setIsLoading(true);

        try {
            // Force cleanup of any existing verifier to prevent "already rendered" error
            if (recaptchaVerifierRef.current) {
                recaptchaVerifierRef.current.clear();
                recaptchaVerifierRef.current = null;
            }
            const container = document.getElementById('recaptcha-container');
            if (container) container.innerHTML = '';

            const appVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
                'size': 'invisible',
                'callback': (response: any) => {
                    // reCAPTCHA solved, allow signInWithPhoneNumber.
                },
                'expired-callback': () => {
                    setError('Recaptcha expired. Please try again.');
                    setIsLoading(false);
                }
            });
            recaptchaVerifierRef.current = appVerifier;

            const phoneNumber = `+91${cleanIdentifier}`;
            const confirmationResult = await authService.sendLoginOtp(phoneNumber, appVerifier);
            confirmationResultRef.current = confirmationResult;
            // OTP Sent successfully, UI will change due to confirmationResultRef being set? 
            // No, we need state to track if OTP sent.
            // But wait, 'loginMethod' is 'otp'. We can add a 'otpSent' state or just check confirmationResultRef
            // For simplicity, let's assume if confirmationResultRef is set, we show OTP input.
            // But `useRef` doesn't trigger re-render. Let's use a state or reuse `otp` state logic?
            // Actually, let's just reuse `otp` input visibility logic.
            // Let's add `isOtpSent` state.
            // For this refactor, I will just add a state `loginStep` similar to signupStep
        } catch (err: any) {
            console.error("OTP Error:", err);
            if (err.code === 'auth/invalid-phone-number') {
                setError("The phone number is invalid.");
            } else if (err.code === 'auth/too-many-requests') {
                setError("Too many requests. Please try again later.");
            } else if (err.code === 'auth/internal-error') {
                setError("Internal Error: Please check if Phone Auth is enabled in Firebase Console and the domain is authorized.");
            } else if (err.code === 'auth/captcha-check-failed') {
                setError("Captcha Check Failed. If you are on localhost, make sure it is in the authorized domains list in Firebase Console.");
            } else {
                setError(err.message || "Failed to send OTP.");
            }
            // Clean up on error
            if (recaptchaVerifierRef.current) {
                recaptchaVerifierRef.current.clear();
                recaptchaVerifierRef.current = null;
            }
            const container = document.getElementById('recaptcha-container');
            if (container) container.innerHTML = '';
        } finally {
            setIsLoading(false);
        }
    };

    // Helper state for Login OTP flow
    const [loginOtpSent, setLoginOtpSent] = useState(false);

    const onLoginSendOtpClick = async (e: React.FormEvent) => {
        await handleSendOtp(e);
        if (!error && confirmationResultRef.current) { // This check might be too early if set in async. 
             // Better rely on successful await completion above.
             setLoginOtpSent(true);
        }
    }

    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);
        try {
            await authService.verifyLoginOtp(confirmationResultRef.current, otp);
            // Success handled by auth listener in App.tsx
        } catch (err: any) {
            setError(err.message || "Invalid OTP.");
        } finally {
            setIsLoading(false);
        }
    };

    // LOGIN: Password
    const handlePasswordLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);
        try {
            await authService.login(identifier, password);
        } catch (err: any) {
            setError(err.message || "Authentication failed.");
        } finally {
            setIsLoading(false);
        }
    };

    // SIGNUP: Send OTP
    const handleSignupSendOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (password !== confirmPassword) {
            setError("Passwords do not match.");
            return;
        }
        const cleanMobile = mobileNumber.replace(/\D/g, '').slice(-10);
        if (cleanMobile.length !== 10) {
            setError("Please enter a valid 10-digit mobile number.");
            return;
        }

        setIsLoading(true);
        try {
             // Force cleanup
            if (recaptchaVerifierSignupRef.current) {
                recaptchaVerifierSignupRef.current.clear();
                recaptchaVerifierSignupRef.current = null;
            }
            const container = document.getElementById('recaptcha-container-signup');
            if (container) container.innerHTML = '';

            const appVerifier = new RecaptchaVerifier(auth, 'recaptcha-container-signup', {
                'size': 'invisible',
                'callback': (response: any) => {
                    // reCAPTCHA solved
                },
                'expired-callback': () => {
                    setError('Recaptcha expired. Please try again.');
                    setIsLoading(false);
                }
            });
            recaptchaVerifierSignupRef.current = appVerifier;

            const phoneNumber = `+91${cleanMobile}`;
            const confirmationResult = await authService.sendLoginOtp(phoneNumber, appVerifier);
            confirmationResultRef.current = confirmationResult;
            setSignupStep('otp');
        } catch (err: any) {
            console.error("Signup OTP Error:", err);
            if (err.code === 'auth/internal-error') {
                setError("Internal Error: Please ensure 'Phone' sign-in provider is enabled in Firebase Console and 'localhost' (or your domain) is in Authorized Domains.");
            } else if (err.code === 'auth/captcha-check-failed') {
                setError("Captcha failed. Please check Authorized Domains in Firebase Console.");
            } else {
                setError(err.message || "Failed to send OTP.");
            }
             // Clean up
            if (recaptchaVerifierSignupRef.current) {
                recaptchaVerifierSignupRef.current.clear();
                recaptchaVerifierSignupRef.current = null;
            }
            const container = document.getElementById('recaptcha-container-signup');
            if (container) container.innerHTML = '';
        } finally {
            setIsLoading(false);
        }
    };

    // SIGNUP: Verify OTP and Register
    const handleSignupVerifyOtpAndRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);
        try {
            // 1. Verify OTP to prove ownership of phone number
            await authService.verifyLoginOtp(confirmationResultRef.current, otp);
            
            // 2. If successful, the user is signed in with phone auth temporarily.
            // We need to link or create the actual account with email/password.
            // However, our current `authService.register` creates a NEW user with email/password.
            // So we should sign out the temporary phone user first.
            await authService.logout();

            // 3. Create the actual account
            await authService.register(email, password, role, name, companyName, mobileNumber, referralCode);
            
            // Success! App.tsx will redirect.
        } catch (err: any) {
            setError(err.message || "Verification or Registration failed.");
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

    const renderError = () => {
        if (!error) return null;
        const isHostnameError = error.includes("Hostname match not found") || error.includes("auth/unauthorized-domain");
        
        return (
            <div className={`mb-4 p-4 rounded-lg border-l-4 ${isHostnameError ? 'bg-yellow-50 border-yellow-500 text-yellow-700' : 'bg-red-50 border-red-500 text-red-700'} dark:bg-opacity-10`}>
                <div className="flex items-start">
                    <ExclamationTriangleIcon className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="font-bold text-sm">{isHostnameError ? "Action Required: Authorize Domain" : "Authentication Error"}</p>
                        <p className="text-sm mt-1">{error}</p>
                        {isHostnameError && (
                            <div className="mt-2 text-xs bg-white bg-opacity-50 p-2 rounded">
                                1. Go to <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" className="underline font-bold">Firebase Console</a><br/>
                                2. Authentication {'>'} Settings {'>'} Authorized Domains<br/>
                                3. Add: <strong>{window.location.hostname}</strong>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
            <div className="max-w-md w-full space-y-8 bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-xl">
                <div className="text-center">
                    <LogoIcon className="mx-auto h-12 w-auto" />
                    <h2 className="mt-6 text-3xl font-extrabold text-gray-900 dark:text-white">
                        {authMode === 'login' ? (loginMethod === 'otp' ? (!loginOtpSent ? 'Sign in with OTP' : 'Enter Verification Code') : 'Sign in with Password') : (signupStep === 'otp' ? 'Verify Mobile' : 'Create Your Account')}
                    </h2>
                    <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
                        {platformSettings.welcomeMessage || "Welcome to BIGYAPON"}
                    </p>
                </div>

                {renderError()}

                {/* LOGIN FORM */}
                {authMode === 'login' && (
                    <div className="mt-8 space-y-6">
                        {loginMethod === 'otp' ? (
                            !loginOtpSent ? (
                                <form onSubmit={onLoginSendOtpClick} className="space-y-6">
                                    <div>
                                        <label htmlFor="identifier" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Mobile Number</label>
                                        <input
                                            id="identifier"
                                            type="tel"
                                            required
                                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                            placeholder="10-digit number"
                                            value={identifier}
                                            onChange={(e) => setIdentifier(e.target.value)}
                                        />
                                    </div>
                                    <div id="recaptcha-container"></div>
                                    <button type="submit" disabled={isLoading} className="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50">
                                        {isLoading ? 'Sending OTP...' : 'Send OTP'}
                                    </button>
                                    <div className="text-center">
                                        <button type="button" onClick={() => setLoginMethod('password')} className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
                                            Login with Password
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <form onSubmit={handleVerifyOtp} className="space-y-6">
                                    <div>
                                        <label htmlFor="otp" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Enter OTP</label>
                                        <input
                                            id="otp"
                                            type="text"
                                            required
                                            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white text-center tracking-widest"
                                            placeholder="123456"
                                            value={otp}
                                            onChange={(e) => setOtp(e.target.value)}
                                        />
                                    </div>
                                    <button type="submit" disabled={isLoading} className="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50">
                                        {isLoading ? 'Verifying...' : 'Verify & Login'}
                                    </button>
                                    <div className="text-center">
                                        <button type="button" onClick={() => { setLoginOtpSent(false); setOtp(''); }} className="text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400">
                                            Back
                                        </button>
                                    </div>
                                </form>
                            )
                        ) : (
                            <form onSubmit={handlePasswordLogin} className="space-y-6">
                                <div>
                                    <label htmlFor="identifier" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email or Mobile Number</label>
                                    <input
                                        id="identifier"
                                        type="text"
                                        required
                                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                        placeholder="user@example.com or 9876543210"
                                        value={identifier}
                                        onChange={(e) => setIdentifier(e.target.value)}
                                    />
                                </div>
                                <div>
                                    <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
                                    <input
                                        id="password"
                                        type="password"
                                        required
                                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                        placeholder="••••••••"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                    />
                                </div>
                                <button type="submit" disabled={isLoading} className="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50">
                                    {isLoading ? 'Logging in...' : 'Login'}
                                </button>
                                <div className="text-center">
                                    <button type="button" onClick={() => setLoginMethod('otp')} className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
                                        Login via Mobile OTP
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                )}

                {/* SIGNUP FORM */}
                {authMode === 'signup' && (
                    <div className="mt-8 space-y-6">
                        {signupStep === 'form' ? (
                            <form onSubmit={handleSignupSendOtp} className="space-y-4">
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
                                
                                <div id="recaptcha-container-signup"></div>

                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                                >
                                    {isLoading ? 'Sending OTP...' : 'Verify Mobile & Sign Up'}
                                </button>
                            </form>
                        ) : (
                            <form onSubmit={handleSignupVerifyOtpAndRegister} className="space-y-6">
                                <div className="text-center">
                                    <p className="text-sm text-gray-500 mb-4">
                                        OTP sent to +91 {mobileNumber.slice(-4).padStart(10, '*')}
                                    </p>
                                    <label htmlFor="signup-otp" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Enter OTP</label>
                                    <input
                                        id="signup-otp"
                                        type="text"
                                        required
                                        className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-white text-center tracking-widest text-xl"
                                        placeholder="123456"
                                        value={otp}
                                        onChange={(e) => setOtp(e.target.value)}
                                        maxLength={6}
                                    />
                                </div>
                                <button type="submit" disabled={isLoading} className="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50">
                                    {isLoading ? 'Creating Account...' : 'Verify & Create Account'}
                                </button>
                                <div className="text-center">
                                    <button type="button" onClick={() => { setSignupStep('form'); setOtp(''); }} className="text-sm font-medium text-gray-500 hover:text-gray-700 dark:text-gray-400">
                                        Back to Form
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                )}

                {platformSettings.isGoogleLoginEnabled && (
                    <>
                        <div className="relative mt-6">
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
                    </>
                )}

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
