
import React, { useState, useEffect, useRef } from 'react';
import { LogoIcon, GoogleIcon, ExclamationTriangleIcon } from './Icons';
import { UserRole, PlatformSettings } from '../types';
import { authService } from '../services/authService';
import StaffLoginModal from './StaffLoginModal';
import { ConfirmationResult } from 'firebase/auth';
import { auth, firebaseConfig, isFirebaseConfigured, RecaptchaVerifier } from '../services/firebase';


interface LoginPageProps {
  platformSettings: PlatformSettings;
}

type AuthMode = 'login' | 'signup';
type LoginMethod = 'email' | 'otp';

const isValidEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const isValidIndianMobile = (mobile: string): boolean => {
  const mobileRegex = /^[6-9]\d{9}$/;
  return mobileRegex.test(mobile);
};

const CopyableInput: React.FC<{ value: string }> = ({ value }) => {
    const [copied, setCopied] = useState(false);
    const copyToClipboard = () => {
        navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    return (
        <div className="mt-2 flex items-center gap-2">
            <input 
                type="text" 
                readOnly 
                value={value} 
                className="w-full p-2 bg-white text-gray-900 border border-gray-300 rounded-md font-mono text-sm dark:bg-gray-800 dark:text-gray-100 dark:border-gray-500"
            />
            <button 
                type="button" 
                onClick={copyToClipboard}
                className="px-3 py-2 text-sm bg-gray-200 rounded-md hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-500"
            >
                {copied ? 'Copied!' : 'Copy'}
            </button>
        </div>
    );
};


const ForgotPasswordModal: React.FC<{ onClose: () => void; platformSettings: PlatformSettings }> = ({ onClose, platformSettings }) => {
    const [resetMethod, setResetMethod] = useState<'email' | 'otp'>('email');
    
    // Email state
    const [email, setEmail] = useState('');
    
    // OTP state
    const [otpStep, setOtpStep] = useState<'enter_number' | 'enter_otp' | 'set_password'>('enter_number');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmNewPassword, setConfirmNewPassword] = useState('');
    const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);

    // General state
    const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'verifying' | 'verified' | 'error'>('idle');
    const [error, setError] = useState('');
    const recaptchaVerifierForgotRef = useRef<RecaptchaVerifier | null>(null);

    useEffect(() => {
        // Cleanup ReCaptcha on unmount
        return () => {
            if (recaptchaVerifierForgotRef.current) {
                try { recaptchaVerifierForgotRef.current.clear(); } catch(e) {}
                recaptchaVerifierForgotRef.current = null;
            }
            const container = document.getElementById('recaptcha-container-forgot');
            if (container) container.innerHTML = '';
        };
    }, []);

    const resetState = () => {
        setStatus('idle');
        setError('');
        setOtpStep('enter_number');
        setPhoneNumber('');
        setOtp('');
        setNewPassword('');
        setConfirmNewPassword('');
        setConfirmationResult(null);
    };

    const handleEmailSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setStatus('sending');
        setError('');
        try {
            await authService.sendPasswordResetEmail(email);
            setStatus('sent');
        } catch (err: any) {
            if (err.code === 'auth/unauthorized-domain' || err.code === 'auth/network-request-failed') {
                setError('auth/unauthorized-domain');
            } else if (err.code === 'auth/auth-domain-config-required') {
                setError('auth/auth-domain-config-required');
            } else {
                setError('Failed to send reset email. Please check the address and try again.');
            }
            setStatus('error');
            console.error(err);
        }
    };

    const handleSendOtp = async () => {
        setError('');
        let fullPhoneNumber = phoneNumber.trim();

        if (/^\d{10}$/.test(fullPhoneNumber)) {
            fullPhoneNumber = `+91${fullPhoneNumber}`;
        }
        else if (!/^\+\d{11,14}$/.test(fullPhoneNumber)) {
            setError("Please enter a valid 10-digit mobile number, or a full number with country code.");
            return;
        }

        setStatus('sending');
        try {
            // Clear existing verifier if any
            if (recaptchaVerifierForgotRef.current) {
                try { recaptchaVerifierForgotRef.current.clear(); } catch(e) {}
                recaptchaVerifierForgotRef.current = null;
            }

            const container = document.getElementById('recaptcha-container-forgot');
            if (container) container.innerHTML = '';

            recaptchaVerifierForgotRef.current = new RecaptchaVerifier(auth, 'recaptcha-container-forgot', { 
                'size': 'invisible',
                'callback': () => {
                    // ReCaptcha solved
                },
                'expired-callback': () => {
                    setError("Recaptcha expired. Please try again.");
                    setStatus('idle');
                }
            });
            
            const appVerifier = recaptchaVerifierForgotRef.current;
            
            const confirmation = await authService.sendLoginOtp(fullPhoneNumber, appVerifier);
            setConfirmationResult(confirmation);
            setOtpStep('enter_otp');
            setStatus('sent');
        } catch (err: any) {
            console.error("OTP Error", err);
            if (recaptchaVerifierForgotRef.current) {
                try { recaptchaVerifierForgotRef.current.clear(); } catch(e) {}
                recaptchaVerifierForgotRef.current = null;
            }
            const container = document.getElementById('recaptcha-container-forgot');
            if (container) container.innerHTML = '';
            
            if (err.code === 'auth/unauthorized-domain' || err.code === 'auth/network-request-failed') {
                setError('auth/unauthorized-domain');
            } else if (err.code === 'auth/auth-domain-config-required') {
                setError('auth/auth-domain-config-required');
            } else if (err.code === 'auth/internal-error') {
                setError('auth/internal-error');
            } else if (err.code === 'auth/too-many-requests') {
                setError('Too many requests. Please try again later.');
            } else {
                setError("Failed to send OTP. Please check the number or try again.");
            }
            setStatus('error');
        }
    };

    const handleVerifyOtp = async () => {
        setError('');
        if (!confirmationResult || !otp.trim()) {
            setError("Please enter the OTP.");
            return;
        }
        setStatus('verifying');
        try {
            // This signs the user in temporarily
            await authService.verifyLoginOtp(confirmationResult, otp);
            setOtpStep('set_password');
            setStatus('verified');
        } catch (err: any) {
            if (err.code === 'auth/unauthorized-domain' || err.code === 'auth/network-request-failed') {
                setError('auth/unauthorized-domain');
            } else if (err.code === 'auth/auth-domain-config-required') {
                setError('auth/auth-domain-config-required');
            } else {
                setError("Invalid OTP. Please try again.");
            }
            setStatus('error');
        }
    };
    
    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        if (newPassword !== confirmNewPassword) {
            setError("Passwords do not match.");
            return;
        }
        if (newPassword.length < 8) {
            setError("Password must be at least 8 characters long.");
            return;
        }
        setStatus('sending');
        try {
            await authService.updateUserPassword(newPassword);
            setStatus('sent'); // Reuse 'sent' status for success message
        } catch (err: any) {
             if (err.code === 'auth/unauthorized-domain' || err.code === 'auth/network-request-failed') {
                setError('auth/unauthorized-domain');
            } else if (err.code === 'auth/auth-domain-config-required') {
                setError('auth/auth-domain-config-required');
            } else {
                setError(err.message || "Failed to reset password.");
            }
            setStatus('error');
        }
    };
    
    const renderError = () => {
        if (status !== 'error' || !error) return null;
        return <p className="text-red-500 text-sm mt-2">{error}</p>;
    };
    
    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            {/* Recaptcha Container specifically for this modal */}
            <div id="recaptcha-container-forgot"></div>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 w-full max-w-md relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:text-gray-300 dark:hover:text-gray-100">
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
                <h2 className="text-xl font-bold text-center text-gray-800 dark:text-gray-100 mb-2">Forgot Password</h2>

                <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
                    <button onClick={() => { setResetMethod('email'); resetState(); }} className={`w-full py-2 text-sm font-medium transition-colors ${resetMethod === 'email' ? 'text-indigo-600 border-b-2 border-indigo-600 dark:text-indigo-400 dark:border-indigo-400' : 'text-gray-500 dark:text-gray-400'}`}>Reset via Email</button>
                    {platformSettings.isForgotPasswordOtpEnabled && (
                        <button onClick={() => { setResetMethod('otp'); resetState(); }} className={`w-full py-2 text-sm font-medium transition-colors ${resetMethod === 'otp' ? 'text-indigo-600 border-b-2 border-indigo-600 dark:text-indigo-400 dark:border-indigo-400' : 'text-gray-500 dark:text-gray-400'}`}>Reset via Mobile</button>
                    )}
                </div>

                {resetMethod === 'email' && (
                     status === 'sent' ? (
                         <div className="text-center py-4">
                            <h3 className="text-lg font-bold text-teal-500">Reset Link Sent</h3>
                            <p className="text-gray-600 dark:text-gray-300 mt-2">Please check your email inbox [spm/all mail option] at <span className="font-semibold">{email}</span> for instructions.</p>
                            <button onClick={onClose} className="mt-6 w-full py-2 px-4 text-sm font-semibold rounded-lg text-white bg-indigo-600 hover:bg-indigo-700">Close</button>
                        </div>
                    ) : (
                        <form onSubmit={handleEmailSubmit} className="space-y-4">
                            <p className="text-sm text-gray-600 dark:text-gray-300">Enter your registered email address.</p>
                            <div>
                                <label htmlFor="reset-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email Address</label>
                                <input type="email" id="reset-email" placeholder="your@email.com" className="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" required value={email} onChange={e => setEmail(e.target.value)} />
                            </div>
                            {renderError()}
                            <button type="submit" disabled={status === 'sending'} className="w-full py-2 px-4 text-sm font-semibold rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50">{status === 'sending' ? 'Sending...' : 'Send Reset Link'}</button>
                        </form>
                    )
                )}

                {resetMethod === 'otp' && (
                    status === 'sent' && otpStep === 'set_password' ? (
                         <div className="text-center py-4">
                            <h3 className="text-lg font-bold text-teal-500">Password Reset Successfully</h3>
                            <p className="text-gray-600 dark:text-gray-300 mt-2">You can now log in with your new password.</p>
                            <button onClick={onClose} className="mt-6 w-full py-2 px-4 text-sm font-semibold rounded-lg text-white bg-indigo-600 hover:bg-indigo-700">Close</button>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {otpStep === 'enter_number' && (
                                <>
                                    <p className="text-sm text-gray-600 dark:text-gray-300">Enter your registered mobile number to receive an OTP.</p>
                                    <input 
                                        type="tel" 
                                        value={phoneNumber} 
                                        onChange={e => setPhoneNumber(e.target.value)} 
                                        placeholder="Enter mobile number" 
                                        required 
                                        className="block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" 
                                    />
                                    {renderError()}
                                    <button onClick={handleSendOtp} disabled={status === 'sending'} className="w-full py-2 px-4 text-sm font-semibold rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50">{status === 'sending' ? 'Sending OTP...' : 'Send OTP'}</button>
                                </>
                            )}
                             {otpStep === 'enter_otp' && (
                                <>
                                    <p className="text-sm text-gray-600 dark:text-gray-300">Enter the 6-digit OTP sent to {phoneNumber}.</p>
                                    <input type="text" value={otp} onChange={e => setOtp(e.target.value)} maxLength={6} placeholder="Enter OTP" className="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" />
                                    {renderError()}
                                    <button onClick={handleVerifyOtp} disabled={status === 'verifying'} className="w-full py-2 px-4 text-sm font-semibold rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50">{status === 'verifying' ? 'Verifying...' : 'Verify OTP'}</button>
                                </>
                            )}
                            {otpStep === 'set_password' && (
                                <form onSubmit={handleResetPassword} className="space-y-4">
                                    <p className="text-sm text-gray-600 dark:text-gray-300">OTP verified. Please set a new password.</p>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">New Password</label>
                                        <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} required className="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" />
                                    </div>
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Confirm New Password</label>
                                        <input type="password" value={confirmNewPassword} onChange={e => setConfirmNewPassword(e.target.value)} required className="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" />
                                    </div>
                                    {renderError()}
                                    <button type="submit" disabled={status === 'sending'} className="w-full py-2 px-4 text-sm font-semibold rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50">{status === 'sending' ? 'Resetting...' : 'Reset Password'}</button>
                                </form>
                            )}
                        </div>
                    )
                )}
            </div>
        </div>
    );
};


const LoginPage: React.FC<LoginPageProps> = ({ platformSettings }) => {
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [role, setRole] = useState<UserRole>('brand');
  const [loginMethod, setLoginMethod] = useState<LoginMethod>('otp');
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [showStaffLogin, setShowStaffLogin] = useState(false);
  
  // Signup specific state
  const [signupStep, setSignupStep] = useState<'form' | 'otp'>('form');
  const [signupOtp, setSignupOtp] = useState('');
  const [signupConfirmationResult, setSignupConfirmationResult] = useState<ConfirmationResult | null>(null);
  const recaptchaVerifierSignupRef = useRef<RecaptchaVerifier | null>(null);

  // Form fields
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [name, setName] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [signupMobile, setSignupMobile] = useState('');
  const [referralCode, setReferralCode] = useState('');

  // State management
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);
  const [signupMobileError, setSignupMobileError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  
  // ReCaptcha ref
  const recaptchaVerifierRef = useRef<RecaptchaVerifier | null>(null);

  // Clean ReCaptcha Instance Helper
  const clearRecaptcha = (ref: React.MutableRefObject<RecaptchaVerifier | null>, containerId: string) => {
    if (ref.current) {
        try {
            ref.current.clear();
        } catch (error) {
            console.warn(`Failed to clear recaptcha on ${containerId}`, error);
        }
        ref.current = null;
    }
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = '';
    }
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref') || params.get('code');
    if (ref) {
        setReferralCode(ref);
        setAuthMode('signup');
    }
    // Cleanup ReCaptcha on unmount
    return () => {
        clearRecaptcha(recaptchaVerifierRef, 'recaptcha-container-login');
        clearRecaptcha(recaptchaVerifierSignupRef, 'recaptcha-container-signup');
    };
  }, []);

  const roles: { id: UserRole; label: string }[] = [
    { id: 'brand', label: "Brand" },
    { id: 'influencer', label: "Influencer" },
    { id: 'livetv', label: "Live TV Channel" },
    { id: 'banneragency', label: "Banner Ads Agency" },
  ];

  const handleRoleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newRole = e.target.value as UserRole;
    setRole(newRole);
    if (newRole !== 'livetv' && newRole !== 'banneragency') {
        setCompanyName('');
    }
  };
  
  const resetFormFields = () => {
    setEmail('');
    setPhoneNumber('');
    setPassword('');
    setConfirmPassword('');
    setOtp('');
    setName('');
    setCompanyName('');
    setSignupMobile('');
    setIsOtpSent(false);
    setConfirmationResult(null);
    setError(null);
    setEmailError(null);
    setSignupMobileError(null);
    
    // Signup specific reset
    setSignupStep('form');
    setSignupOtp('');
    setSignupConfirmationResult(null);
    
    // Clean up Recaptcha when switching modes
    clearRecaptcha(recaptchaVerifierRef, 'recaptcha-container-login');
    clearRecaptcha(recaptchaVerifierSignupRef, 'recaptcha-container-signup');
  };
  
  const handleSendLoginOtp = async () => {
      setError(null);
      let fullPhoneNumber = phoneNumber.trim();

      if (/^\d{10}$/.test(fullPhoneNumber)) {
        fullPhoneNumber = `+91${fullPhoneNumber}`;
      } else if (!/^\+\d{10,15}$/.test(fullPhoneNumber)) {
        setError("Please enter a valid 10-digit mobile number.");
        return;
      }
      
      setIsLoading(true);
      try {
          clearRecaptcha(recaptchaVerifierRef, 'recaptcha-container-login');

          const newVerifier = new RecaptchaVerifier(auth, 'recaptcha-container-login', { 
              'size': 'invisible',
              'callback': () => {},
              'expired-callback': () => {
                  setError("Recaptcha expired, please try again.");
                  setIsLoading(false);
                  clearRecaptcha(recaptchaVerifierRef, 'recaptcha-container-login');
              }
          });
          
          recaptchaVerifierRef.current = newVerifier;
          const confirmation = await authService.sendLoginOtp(fullPhoneNumber, newVerifier);
          setConfirmationResult(confirmation);
          setIsOtpSent(true);
          setError(null);
      } catch (err: any) {
          console.error("OTP Send Error:", err);
          handleAuthError(err);
      } finally {
          setIsLoading(false);
      }
  };

  const handleSignupSendOtp = async () => {
      setError(null);
      setIsLoading(true);
      
      let fullPhoneNumber = signupMobile.trim();
      if (/^\d{10}$/.test(fullPhoneNumber)) {
        fullPhoneNumber = `+91${fullPhoneNumber}`;
      } else if (!/^\+\d{10,15}$/.test(fullPhoneNumber)) {
        setError("Please enter a valid 10-digit mobile number.");
        setIsLoading(false);
        return;
      }

      try {
          clearRecaptcha(recaptchaVerifierSignupRef, 'recaptcha-container-signup');

          const container = document.getElementById('recaptcha-container-signup');
          if (!container) {
              throw new Error("Recaptcha container not found in DOM.");
          }

          const newVerifier = new RecaptchaVerifier(auth, 'recaptcha-container-signup', { 
              'size': 'invisible',
              'callback': () => {},
              'expired-callback': () => {
                  setError("Recaptcha expired, please try again.");
                  setIsLoading(false);
                  clearRecaptcha(recaptchaVerifierSignupRef, 'recaptcha-container-signup');
              }
          });
          
          recaptchaVerifierSignupRef.current = newVerifier;
          const confirmation = await authService.sendLoginOtp(fullPhoneNumber, newVerifier);
          setSignupConfirmationResult(confirmation);
          setSignupStep('otp');
          
      } catch (err: any) {
          console.error("Signup OTP Error:", err);
          handleAuthError(err);
      } finally {
          setIsLoading(false);
      }
  };

  const handleSignupVerifyOtpAndRegister = async () => {
      if (!signupConfirmationResult || !signupOtp) {
          setError("Please enter the OTP.");
          return;
      }
      
      setIsLoading(true);
      setError(null);

      try {
          // 1. Verify OTP - This logs the user in as the Phone Auth user
          await signupConfirmationResult.confirm(signupOtp);
          
          // 2. Sign out immediately (we just wanted verification)
          await auth.signOut();

          // 3. Proceed to create the actual Email/Password account
          await authService.register(email, password, role, name, companyName, signupMobile, referralCode);
          
          // Success handled by onAuthChange
      } catch (err: any) {
          console.error("Signup Verify Error:", err);
          setError("Invalid OTP or Registration Failed. " + (err.message || ""));
      } finally {
          setIsLoading(false);
      }
  };

  const handleAuthError = (err: any) => {
      const errorCode = err.code;
      const errorMessage = err.message || '';

      if (errorCode === 'auth/unauthorized-domain' || 
          errorCode === 'auth/captcha-check-failed' ||
          errorCode === 'auth/network-request-failed' ||
          errorMessage.includes('Hostname match not found')) {
        setError('auth/unauthorized-domain');
      } else if (errorCode === 'auth/auth-domain-config-required') {
        setError('auth/auth-domain-config-required');
      } else if (errorCode === 'auth/internal-error') {
          setError('auth/internal-error');
      } else if (errorCode === 'auth/invalid-credential' || errorCode === 'auth/invalid-verification-code') {
          setError('Invalid credentials or OTP. Please check and try again.');
      } else if (errorMessage && errorMessage.includes('blocked')) {
        setError(errorMessage);
      } else if (errorCode === 'auth/too-many-requests') {
          setError('Too many requests. Please wait a while.');
      } else if (errorCode === 'auth/email-already-in-use') {
          setError("Email is already registered.");
      } else {
        setError(errorMessage || 'Authentication failed. Please check your credentials.');
      }
  };

  const handleAuthSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      if (authMode === 'login') {
          setIsLoading(true);
          try {
            if (loginMethod === 'email') {
                await authService.login(email, password);
            } else { // OTP login
                if (!confirmationResult) {
                    setError("Please send an OTP first.");
                    setIsLoading(false);
                    return;
                }
                await authService.verifyLoginOtp(confirmationResult, otp);
            }
          } catch(err: any) {
              handleAuthError(err);
          } finally {
              setIsLoading(false);
          }
      } else { // Signup
          if (password !== confirmPassword) {
              setError("Passwords do not match.");
              return;
          }
          if (password.length < 8 || password.length > 20) {
              setError("Password must be between 8 and 20 characters.");
              return;
          }
          
          // Initiate Signup OTP Flow
          handleSignupSendOtp();
      }
  };

  const handleGoogleSignIn = async () => {
    setError(null);
    setIsLoading(true);
    try {
        await authService.signInWithGoogle(role);
    } catch (err: any) {
        if (err.code !== 'auth/popup-closed-by-user') {
             handleAuthError(err);
        }
    } finally {
        setIsLoading(false);
    }
  };

  const renderError = () => {
    if (!error) return null;

    let title = "Authentication Error";
    let content: React.ReactNode = <p>{error}</p>;

    if (error === 'auth/unauthorized-domain') {
        title = "Action Required: Authorize Domain";
        content = (
            <>
                <p>Firebase authentication requires this app's domain to be on an allowlist. This is a security feature.</p>
                <ol className="list-decimal list-inside space-y-2 mt-3 text-sm">
                    <li>
                        <strong>Go to Auth Settings:</strong>
                        <a 
                            href={`https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/settings/domains`} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="ml-2 font-medium text-indigo-600 dark:text-indigo-400 underline hover:text-indigo-800"
                        >
                            Open "Authorized domains"
                        </a>
                    </li>
                    <li>Click <strong>"Add domain"</strong>.</li>
                    <li>Copy & Paste the domain below.</li>
                </ol>
                <CopyableInput value={window.location.hostname} />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">Then try again. If it fails, refresh the page.</p>
            </>
        );
    } else if (error === 'auth/internal-error') {
        title = "Authentication Provider Issue";
        content = (
            <>
                <p>The request failed. This typically means:</p>
                <ul className="list-disc list-inside space-y-1 mt-2 text-sm">
                    <li>The domain <strong>{window.location.hostname}</strong> is not authorized. Follow the "Authorize Domain" steps above.</li>
                    <li>The <strong>Phone Provider</strong> is not enabled in Firebase Console.</li>
                    <li>Your Firebase project may have exceeded its SMS quota.</li>
                </ul>
            </>
        );
    }

    return (
        <div className="mt-4 text-left bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border-l-4 border-red-500 dark:border-red-600 animate-fade-in-down">
            <h3 className="font-bold text-red-800 dark:text-red-200 mb-2 flex items-center gap-2">
                <ExclamationTriangleIcon className="w-5 h-5 flex-shrink-0" />
                {title}
            </h3>
            <div className="text-red-700 dark:text-red-300 text-sm space-y-2 pl-7">{content}</div>
        </div>
    );
  };


  return (
    <>
        <div id="recaptcha-container-login"></div>
        <div id="recaptcha-container-signup"></div>
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col items-center px-4 py-8 sm:justify-center">
            <div className="w-full max-w-md">
                <div className="flex justify-center w-full mb-8">
                    <LogoIcon showTagline={true} className="h-14 sm:h-16 w-auto" />
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 sm:p-8 transition-all duration-300">
                    <div className="mb-6 text-center">
                        <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">
                            {authMode === 'login' ? 'Welcome Back!' : 'Create Your Account'}
                        </h2>
                        <p className="text-gray-500 dark:text-gray-400 mt-1">
                            {authMode === 'login' ? 'Login to continue to BIGYAPON' : 'Join our community of brands and influencers'}
                        </p>
                    </div>
                    
                    {/* Role Selection */}
                    <div className="mb-6">
                        <label htmlFor="role-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                           I am a...
                        </label>
                        <select
                            id="role-select"
                            value={role}
                            onChange={handleRoleChange}
                            className="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
                        >
                            {roles.map(r => (
                                <option key={r.id} value={r.id}>{r.label}</option>
                            ))}
                        </select>
                    </div>

                    <form onSubmit={handleAuthSubmit}>
                        {/* LOGIN FORM */}
                        {authMode === 'login' && loginMethod === 'email' && (
                            <div className="space-y-4 animate-fade-in-down">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email or Mobile Number</label>
                                    <input 
                                        type="text" 
                                        value={email} 
                                        onChange={e => setEmail(e.target.value)} 
                                        placeholder="Enter email or mobile number" 
                                        required 
                                        className="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" 
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
                                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} required className="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"/>
                                    <div className="flex justify-end mt-1">
                                        <button type="button" onClick={() => setShowForgotPassword(true)} className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">Forgot password?</button>
                                    </div>
                                </div>
                            </div>
                        )}
                        
                        {authMode === 'login' && loginMethod === 'otp' && platformSettings.isOtpLoginEnabled && (
                            <div className="space-y-4 animate-fade-in-down">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Mobile Number</label>
                                    <div className="relative mt-1">
                                        <input
                                            type="tel"
                                            value={phoneNumber}
                                            onChange={e => setPhoneNumber(e.target.value)}
                                            placeholder="+919876543210"
                                            required
                                            disabled={isOtpSent}
                                            className="block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm disabled:bg-gray-200 dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 dark:disabled:bg-gray-600"
                                        />
                                    </div>
                                </div>
                                {isOtpSent && (
                                    <div className="animate-fade-in-down">
                                        <label htmlFor="otp" className="block text-sm font-medium text-gray-700 dark:text-gray-300">OTP Code</label>
                                        <input
                                            type="text"
                                            id="otp"
                                            value={otp}
                                            onChange={(e) => setOtp(e.target.value)}
                                            maxLength={6}
                                            placeholder="Enter 6-digit OTP"
                                            required
                                            className="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
                                        />
                                        <div className="text-right text-sm mt-1">
                                            <button type="button" onClick={() => { setIsOtpSent(false); setOtp(''); setError(null); }} className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
                                                Change Number?
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                        
                        {/* SIGNUP FORM */}
                        {authMode === 'signup' && signupStep === 'form' && (
                                <div className="space-y-4 animate-fade-in-down">
                                 <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Full Name</label>
                                    <input type="text" value={name} onChange={e => setName(e.target.value)} required className="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"/>
                                </div>
                                {role === 'livetv' && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Channel Name</label>
                                        <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} required className="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"/>
                                    </div>
                                )}
                                {role === 'banneragency' && (
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Agency Name</label>
                                        <input type="text" value={companyName} onChange={e => setCompanyName(e.target.value)} required className="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"/>
                                    </div>
                                )}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Mobile Number</label>
                                    <input type="tel" value={signupMobile} onChange={e => {
                                        const val = e.target.value;
                                        setSignupMobile(val);
                                        if (val && !isValidIndianMobile(val)) {
                                            setSignupMobileError("Please enter a valid 10-digit mobile number.");
                                        } else {
                                            setSignupMobileError(null);
                                        }
                                    }} required className={`mt-1 block w-full px-3 py-2 bg-gray-50 border rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 ${signupMobileError ? 'border-red-500' : 'border-gray-300'}`}/>
                                    {signupMobileError && <p className="mt-1 text-xs text-red-500">{signupMobileError}</p>}
                                </div>
                                 <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email Address</label>
                                    <input type="email" value={email} onChange={e => {
                                        const val = e.target.value;
                                        setEmail(val);
                                        if (val && !isValidEmail(val)) {
                                            setEmailError("Please enter a valid email address.");
                                        } else {
                                            setEmailError(null);
                                        }
                                    }} placeholder="your@email.com" required className={`mt-1 block w-full px-3 py-2 bg-gray-50 border rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 ${emailError ? 'border-red-500' : 'border-gray-300'}`} />
                                    {emailError && <p className="mt-1 text-xs text-red-500">{emailError}</p>}
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Create Password</label>
                                    <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="8-20 characters" required className="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Confirm Password</label>
                                    <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} required className="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" />
                                </div>
                                {referralCode && (
                                    <div>
                                        <label className="block text-sm font-medium text-green-600 dark:text-green-400">Referral Code Applied</label>
                                        <input type="text" value={referralCode} disabled className="mt-1 block w-full px-3 py-2 bg-green-50 border border-green-300 rounded-md shadow-sm text-green-800" />
                                    </div>
                                )}
                                </div>
                            )}
                            
                        {authMode === 'signup' && signupStep === 'otp' && (
                            <div className="space-y-4 animate-fade-in-down">
                                <div className="text-center p-3 bg-indigo-50 dark:bg-gray-700 rounded-lg border border-indigo-100 dark:border-gray-600">
                                    <p className="text-sm text-indigo-800 dark:text-indigo-300">OTP sent to <span className="font-bold">{signupMobile}</span></p>
                                </div>
                                <div>
                                    <label htmlFor="signup-otp" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Enter OTP</label>
                                    <input
                                        type="text"
                                        id="signup-otp"
                                        value={signupOtp}
                                        onChange={(e) => setSignupOtp(e.target.value)}
                                        maxLength={6}
                                        placeholder="6-digit code"
                                        required
                                        className="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200 text-center tracking-widest font-mono text-lg"
                                    />
                                </div>
                                <button 
                                    type="button" 
                                    onClick={() => { setSignupStep('form'); setError(null); }}
                                    className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 underline w-full text-center"
                                >
                                    Back to details
                                </button>
                            </div>
                        )}

                        {renderError()}
                        
                        {/* Action Button */}
                        {authMode === 'login' ? (
                            loginMethod === 'otp' && !isOtpSent ? (
                                <>
                                    <button
                                        type="button"
                                        onClick={handleSendLoginOtp}
                                        disabled={isLoading}
                                        className="mt-8 w-full py-3 px-4 text-sm font-semibold rounded-lg text-white bg-gradient-to-r from-teal-400 to-indigo-600 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                                    >
                                        {isLoading ? 'Sending OTP...' : 'Send OTP'}
                                    </button>
                                    <div className="text-center text-sm text-gray-600 mt-4 dark:text-gray-400">
                                        <button type="button" onClick={() => { setLoginMethod('email'); resetFormFields(); }} className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
                                            Login with Password
                                        </button>
                                    </div>
                                </>
                            ) : loginMethod === 'otp' && isOtpSent ? (
                                <button type="submit" disabled={isLoading} className="mt-8 w-full py-3 px-4 text-sm font-semibold rounded-lg text-white bg-gradient-to-r from-teal-400 to-indigo-600 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed">
                                    {isLoading ? 'Processing...' : 'Login'}
                                </button>
                            ) : (
                                <>
                                    <button type="submit" disabled={isLoading} className="mt-8 w-full py-3 px-4 text-sm font-semibold rounded-lg text-white bg-gradient-to-r from-teal-400 to-indigo-600 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed">
                                        {isLoading ? 'Processing...' : 'Login'}
                                    </button>
                                    <div className="text-center text-sm text-gray-600 mt-4 dark:text-gray-400">
                                        <button type="button" onClick={() => { setLoginMethod('otp'); resetFormFields(); }} className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
                                            Login via Mobile OTP
                                        </button>
                                    </div>
                                </>
                            )
                        ) : (
                            // Signup Buttons
                            signupStep === 'form' ? (
                                <button type="submit" disabled={isLoading || !!emailError || !!signupMobileError} className="mt-8 w-full py-3 px-4 text-sm font-semibold rounded-lg text-white bg-gradient-to-r from-teal-400 to-indigo-600 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed">
                                    {isLoading ? 'Processing...' : 'Send Verification OTP'}
                                </button>
                            ) : (
                                <button type="button" onClick={handleSignupVerifyOtpAndRegister} disabled={isLoading} className="mt-8 w-full py-3 px-4 text-sm font-semibold rounded-lg text-white bg-gradient-to-r from-green-500 to-teal-600 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed">
                                    {isLoading ? 'Creating Account...' : 'Verify & Create Account'}
                                </button>
                            )
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
                                        Sign Up
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
                    </form>

                    <div className="mt-6 relative">
                        <div className="absolute inset-0 flex items-center" aria-hidden="true">
                            <div className="w-full border-t border-gray-300 dark:border-gray-600" />
                        </div>
                        <div className="relative flex justify-center text-sm">
                            <span className="px-2 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400">Or</span>
                        </div>
                    </div>

                    <div className="mt-6">
                        <button
                            type="button"
                            onClick={handleGoogleSignIn}
                            disabled={isLoading}
                            className="w-full flex justify-center items-center py-2.5 px-4 border border-gray-300 dark:border-gray-600 rounded-lg shadow-sm bg-white dark:bg-gray-800 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                        >
                            <GoogleIcon className="w-5 h-5 mr-3" />
                            Continue with Google
                        </button>
                    </div>
                    
                    {authMode === 'login' && (
                        <div className="mt-6 text-center text-sm text-gray-600 dark:text-gray-400">
                            <button type="button" onClick={() => setShowStaffLogin(true)} className="font-medium text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200">
                                BIGYAPON Staff Login
                            </button>
                        </div>
                    )}

                </div>
            </div>
        </div>

        {showForgotPassword && <ForgotPasswordModal onClose={() => setShowForgotPassword(false)} platformSettings={platformSettings} />}
        {showStaffLogin && <StaffLoginModal onClose={() => setShowStaffLogin(false)} platformSettings={platformSettings} />}
    </>
  );
};

export default LoginPage;
