
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

    // Resend Timer
    const [timer, setTimer] = useState(0);
    useEffect(() => {
        let interval: any;
        if (timer > 0) {
            interval = setInterval(() => setTimer((prev) => prev - 1), 1000);
        }
        return () => clearInterval(interval);
    }, [timer]);

    // Refs for Recaptcha
    const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);
    const recaptchaVerifierSignupRef = useRef<RecaptchaVerifier | null>(null);
    const confirmationResultRef = useRef<any>(null);

    // Helper state for Login OTP flow
    const [loginOtpSent, setLoginOtpSent] = useState(false);

    // Cleanup Recaptcha on unmount
    useEffect(() => {
        return () => {
            clearRecaptcha('login');
            clearRecaptcha('signup');
        };
    }, []);

    const clearRecaptcha = (type: 'login' | 'signup') => {
        if (type === 'login') {
            if (recaptchaVerifierRef.current) {
                try {
                    recaptchaVerifierRef.current.clear();
                } catch (e) { console.warn(e) }
                recaptchaVerifierRef.current = null;
            }
            const container = document.getElementById('recaptcha-container');
            if (container) container.innerHTML = '';
        } else {
            if (recaptchaVerifierSignupRef.current) {
                try {
                    recaptchaVerifierSignupRef.current.clear();
                } catch (e) { console.warn(e) }
                recaptchaVerifierSignupRef.current = null;
            }
            const container = document.getElementById('recaptcha-container-signup');
            if (container) container.innerHTML = '';
        }
    };

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
        setLoginOtpSent(false);
        clearRecaptcha('login');
        clearRecaptcha('signup');
    };

    // Helper to format error messages
    const getFriendlyErrorMessage = (err: any) => {
        const code = err.code || '';
        const message = err.message || '';

        if (code === 'auth/invalid-credential' || message.includes('invalid-credential')) {
            return "Invalid credentials. Please check your details.";
        }
        if (code === 'auth/user-not-found') {
            return "Account not found. Please sign up.";
        }
        if (code === 'auth/wrong-password') {
            return "Incorrect password.";
        }
        if (code === 'auth/too-many-requests') {
            return "Too many attempts. Please try again later.";
        }
        if (code === 'auth/invalid-email') {
            return "Invalid email address format.";
        }
        if (code === 'auth/email-already-in-use') {
            return "This email is already registered.";
        }
        if (code === 'auth/network-request-failed') {
            return "Network error. Please check your internet connection.";
        }
        
        // Strip Firebase wrapper for other errors
        return message.replace('Firebase: ', '').replace('Error (auth/', '').replace(').', '').replace(/-/g, ' ');
    };

    // LOGIN: Send OTP
    const handleSendOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        
        const cleanIdentifier = identifier.replace(/\D/g, '').slice(-10);
        if (cleanIdentifier.length !== 10) {
            setError("Please enter a valid 10-digit mobile number.");
            return;
        }

        setIsLoading(true);

        try {
            clearRecaptcha('login');
            await new Promise(resolve => setTimeout(resolve, 100));

            const container = document.getElementById('recaptcha-container');
            if (!container) {
                throw new Error("Recaptcha container not found. Please refresh the page.");
            }

            const appVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
                'size': 'invisible',
                'callback': (response: any) => {},
                'expired-callback': () => {
                    setError('Recaptcha expired. Please try again.');
                    setIsLoading(false);
                    clearRecaptcha('login');
                }
            });
            recaptchaVerifierRef.current = appVerifier;

            const phoneNumber = `+91${cleanIdentifier}`;
            const confirmationResult = await authService.sendLoginOtp(phoneNumber, appVerifier);
            confirmationResultRef.current = confirmationResult;
            setLoginOtpSent(true);
            setTimer(60); 
        } catch (err: any) {
            console.error("OTP Error:", err);
            setError(getFriendlyErrorMessage(err));
            clearRecaptcha('login');
        } finally {
            setIsLoading(false);
        }
    };

    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);
        try {
            if (!confirmationResultRef.current) throw new Error("Session expired. Please resend OTP.");
            await authService.verifyLoginOtp(confirmationResultRef.current, otp);
        } catch (err: any) {
            setError("Invalid OTP. Please check the code and try again.");
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
            setError(getFriendlyErrorMessage(err));
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
        if (!email || !name || !role) {
            setError("Please fill all fields.");
            return;
        }
        const cleanMobile = mobileNumber.replace(/\D/g, '').slice(-10);
        if (cleanMobile.length !== 10) {
            setError("Please enter a valid 10-digit mobile number.");
            return;
        }

        setIsLoading(true);
        try {
            clearRecaptcha('signup');
            await new Promise(resolve => setTimeout(resolve, 100));

            const container = document.getElementById('recaptcha-container-signup');
            if (!container) throw new Error("Recaptcha container not found.");

            const appVerifier = new RecaptchaVerifier(auth, 'recaptcha-container-signup', {
                'size': 'invisible',
                'callback': (response: any) => {},
                'expired-callback': () => {
                    setError('Recaptcha expired. Please try again.');
                    setIsLoading(false);
                    clearRecaptcha('signup');
                }
            });
            recaptchaVerifierSignupRef.current = appVerifier;

            const phoneNumber = `+91${cleanMobile}`;
            const confirmationResult = await authService.sendLoginOtp(phoneNumber, appVerifier);
            confirmationResultRef.current = confirmationResult;
            setSignupStep('otp');
            setTimer(60);
        } catch (err: any) {
            console.error("Signup OTP Error:", err);
            setError(getFriendlyErrorMessage(err));
            clearRecaptcha('signup');
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
            if (!confirmationResultRef.current) throw new Error("Session expired.");
            
            // 1. Verify OTP - signs the user in as a Phone Auth user
            await confirmationResultRef.current.confirm(otp);
            
            // 2. Link this authenticated session with Email/Password and create profile
            await authService.registerAfterPhoneAuth(email, password, role, name, companyName, mobileNumber, referralCode);
            
        } catch (err: any) {
            console.error("Verification/Registration error:", err);
            setError(getFriendlyErrorMessage(err));
        } finally {
            setIsLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        setError(null);
        try {
            await authService.signInWithGoogle(role);
        } catch (err: any) {
            setError(getFriendlyErrorMessage(err));
        }
    };

    const renderError = () => {
        if (!error) return null;
        const isHostnameError = error.includes("Hostname match") || error.includes("unauthorized-domain") || error.includes("internal-error") || error.includes("Captcha Check Failed");
        
        return (
            <div className={`mb-4 p-4 rounded-lg border-l-4 ${isHostnameError ? 'bg-yellow-50 border-yellow-500 text-yellow-700' : 'bg-red-50 border-red-500 text-red-700'} dark:bg-opacity-10`}>
                <div className="flex items-start">
                    <ExclamationTriangleIcon className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5" />
                    <div>
                        <p className="font-bold text-sm">{isHostnameError ? "Setup Required" : "Error"}</p>
                        <p className="text-sm mt-1">{error}</p>
                        {isHostnameError && (
                            <div className="mt-2 text-xs bg-white bg-opacity-50 p-2 rounded">
                                <strong>To Fix:</strong><br/>
                                1. Go to <a href="https://console.firebase.google.com/" target="_blank" rel="noreferrer" className="underline font-bold">Firebase Console</a>.<br/>
                                2. Go to <strong>Authentication</strong> &gt; <strong>Settings</strong> &gt; <strong>Authorized domains</strong>.<br/>
                                3. Click "Add domain" and paste this:<br/>
                                <code className="bg-black text-white px-1 rounded select-all">{window.location.hostname}</code>
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
                                <form onSubmit={handleSendOtp} className="space-y-6">
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
                                    
                                    <button type="submit" disabled={isLoading} className="w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50">
                                        {isLoading ? 'Sending OTP...' : 'Send OTP'}
                                    </button>
                                    <div className="text-center">
                                        <button type="button" onClick={() => { setLoginMethod('password'); clearRecaptcha('login'); }} className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
                                            Login with Password
                                        </button>
                                    </div>
                                </form>
                            ) : (
                                <form onSubmit={handleVerifyOtp} className="space-y-6">
                                    <div className="text-center mb-2">
                                        <p className="text-sm text-gray-500">OTP sent to +91 {identifier.slice(-4).padStart(10, '*')}</p>
                                    </div>
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
                                    <div className="flex justify-between items-center text-sm mt-4">
                                        <button type="button" onClick={() => { setLoginOtpSent(false); setOtp(''); clearRecaptcha('login'); }} className="text-gray-500 hover:text-gray-700 dark:text-gray-400">
                                            Change Number
                                        </button>
                                        <button 
                                            type="button" 
                                            onClick={handleSendOtp} 
                                            disabled={timer > 0 || isLoading}
                                            className={`font-medium ${timer > 0 ? 'text-gray-400 cursor-not-allowed' : 'text-indigo-600 hover:text-indigo-500'}`}
                                        >
                                            {timer > 0 ? `Resend in ${timer}s` : 'Resend OTP'}
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
                                    <button type="button" onClick={() => { setLoginMethod('otp'); clearRecaptcha('login'); }} className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400">
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
                                
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                                >
                                    {isLoading ? 'Sending OTP...' : 'Verify Mobile & Create Account'}
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
                                    {isLoading ? 'Creating Account...' : 'Verify & Complete Signup'}
                                </button>
                                <div className="flex justify-between items-center text-sm mt-4">
                                    <button type="button" onClick={() => { setSignupStep('form'); setOtp(''); clearRecaptcha('signup'); }} className="text-gray-500 hover:text-gray-700 dark:text-gray-400">
                                        Back to Form
                                    </button>
                                    <button 
                                        type="button" 
                                        onClick={handleSignupSendOtp} 
                                        disabled={timer > 0 || isLoading}
                                        className={`font-medium ${timer > 0 ? 'text-gray-400 cursor-not-allowed' : 'text-indigo-600 hover:text-indigo-500'}`}
                                    >
                                        {timer > 0 ? `Resend in ${timer}s` : 'Resend OTP'}
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

            {/* RECAPTCHA CONTAINERS MOVED OUTSIDE CONDITIONAL RENDERING */}
            <div id="recaptcha-container"></div>
            <div id="recaptcha-container-signup"></div>

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
