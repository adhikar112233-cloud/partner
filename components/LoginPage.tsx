
import React, { useState, useEffect, useRef } from 'react';
import { LogoIcon, GoogleIcon, ExclamationTriangleIcon, EnvelopeIcon, ChatBubbleLeftEllipsisIcon } from './Icons';
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
type SignupStep = 'form' | 'method_selection' | 'otp_verification';

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
  const [signupStep, setSignupStep] = useState<SignupStep>('form');
  
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
  const signupRecaptchaRef = useRef<RecaptchaVerifier | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const ref = params.get('ref') || params.get('code');
    if (ref) {
        setReferralCode(ref);
        setAuthMode('signup');
    }
    // Cleanup ReCaptcha on mount/unmount
    return () => {
        if (recaptchaVerifierRef.current) {
            try { recaptchaVerifierRef.current.clear(); } catch(e) {}
            recaptchaVerifierRef.current = null;
        }
        if (signupRecaptchaRef.current) {
            try { signupRecaptchaRef.current.clear(); } catch(e) {}
            signupRecaptchaRef.current = null;
        }
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
    setSignupStep('form');
    
    // Clean up Recaptcha when switching modes
    if (recaptchaVerifierRef.current) {
        try { recaptchaVerifierRef.current.clear(); } catch(e) { console.warn(e); }
        recaptchaVerifierRef.current = null;
    }
    if (signupRecaptchaRef.current) {
        try { signupRecaptchaRef.current.clear(); } catch(e) { console.warn(e); }
        signupRecaptchaRef.current = null;
    }
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
          if (recaptchaVerifierRef.current) {
              try { recaptchaVerifierRef.current.clear(); } catch (e) {}
              recaptchaVerifierRef.current = null;
          }
          
          const container = document.getElementById('recaptcha-container-login');
          if (container) { container.innerHTML = ''; }

          const newVerifier = new RecaptchaVerifier(auth, 'recaptcha-container-login', { 
              'size': 'invisible',
              'callback': () => {},
              'expired-callback': () => {
                  setError("Recaptcha expired, please try again.");
                  setIsLoading(false);
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
      let fullPhoneNumber = signupMobile.trim();

      if (/^\d{10}$/.test(fullPhoneNumber)) {
        fullPhoneNumber = `+91${fullPhoneNumber}`;
      } else if (!/^\+\d{10,15}$/.test(fullPhoneNumber)) {
        setError("Invalid mobile number format.");
        return;
      }

      setIsLoading(true);
      try {
          // 1. Aggressively clear old instances
          if (signupRecaptchaRef.current) {
              try { signupRecaptchaRef.current.clear(); } catch(e) {}
              signupRecaptchaRef.current = null;
          }
          
          const containerId = 'recaptcha-container-signup';
          const container = document.getElementById(containerId);
          if (container) { 
              container.innerHTML = ''; 
          } else {
              throw new Error(`DOM Element ${containerId} not found.`);
          }

          // 2. Create new verifier
          const newVerifier = new RecaptchaVerifier(auth, containerId, { 
              'size': 'invisible',
              'callback': () => {},
              'expired-callback': () => {
                  setError("Recaptcha expired, please try again.");
                  setIsLoading(false);
              }
          });
          signupRecaptchaRef.current = newVerifier;

          // 3. Send OTP
          const confirmation = await authService.sendLoginOtp(fullPhoneNumber, newVerifier);
          setConfirmationResult(confirmation);
          setSignupStep('otp_verification');
          setError(null);
      } catch(err: any) {
          console.error("Signup OTP Error:", err);
          if (err.code === 'auth/internal-error') {
              setError('auth/internal-error'); // Use specific code to trigger the detailed message
          } else {
              handleAuthError(err);
          }
      } finally {
          setIsLoading(false);
      }
  };

  const handleSignupVerifyOtpAndRegister = async () => {
      if (!confirmationResult || !otp) {
          setError("Please enter the OTP.");
          return;
      }
      setIsLoading(true);
      try {
          // 1. Verify OTP (creates temp session)
          await confirmationResult.confirm(otp);
          
          // 2. Create actual account
          await authService.register(email, password, role, name, companyName, signupMobile, referralCode);
          alert("Registration successful! Welcome to BIGYAPON.");
          // Note: authService.register auto-signs in the user with the new email creds.
          
      } catch (err: any) {
          console.error("Registration Error:", err);
          if(err.code === 'auth/invalid-verification-code') {
              setError("Invalid OTP. Please try again.");
          } else if (err.code === 'auth/email-already-in-use') {
              setError("Email is already registered.");
          } else {
              handleAuthError(err);
          }
      } finally {
          setIsLoading(false);
      }
  };

  const handleDirectRegister = async () => {
      setIsLoading(true);
      try {
          await authService.register(email, password, role, name, companyName, signupMobile, referralCode);
          alert("Registration successful! Welcome to BIGYAPON.");
      } catch (err: any) {
          handleAuthError(err);
      } finally {
          setIsLoading(false);
      }
  };

  const handleAuthError = (err: any) => {
      if (err.code === 'auth/unauthorized-domain' || err.code === 'auth/network-request-failed') {
        setError('auth/unauthorized-domain');
      } else if (err.code === 'auth/auth-domain-config-required') {
        setError('auth/auth-domain-config-required');
      } else if (err.code === 'auth/internal-error') {
          setError('auth/internal-error');
      } else if (err.code === 'auth/invalid-credential' || err.code === 'auth/invalid-verification-code') {
          setError('Invalid credentials or OTP. Please check and try again.');
      } else if (err.message && err.message.includes('blocked')) {
        setError(err.message);
      } else if (err.code === 'auth/too-many-requests') {
          setError('Too many requests. Please wait a while.');
      } else {
        setError(err.message || 'Authentication failed. Please check your credentials.');
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
          // Proceed to verification method selection
          setSignupStep('method_selection');
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
                <p>Firebase authentication requires this app's domain to be on an allowlist. This is a one-time setup.</p>
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
                    <li>The domain <strong>{window.location.hostname}</strong> is not whitelisted in Firebase Authentication Settings.</li>
                    <li>The <strong>Phone Provider</strong> is not enabled in Firebase Console.</li>
                    <li>Your Firebase project may have exceeded its SMS quota (Spark plan limit is 10/day). Upgrade to Blaze or add a test phone number.</li>
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
                    
                    {/* Role Selection (Only relevant for Signup or Google Login context, technically) */}
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
                                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email Address</label>
                                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" required className="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" />
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
                        {authMode === 'signup' && (
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

                        {authMode === 'login' && (
                            <div className="text-center text-sm text-gray-600 mt-4 dark:text-gray-400">
                                <button type="button" onClick={() => { setLoginMethod(loginMethod === 'email' ? 'otp' : 'email'); resetFormFields(); }} className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
                                    {loginMethod === 'email' ? 'Login with Mobile OTP' : 'Login with Email'}
                                </button>
                            </div>
                        )}

                        {renderError()}
                        
                        {/* Action Button */}
                        {authMode === 'login' && loginMethod === 'otp' && !isOtpSent ? (
                            <button
                                type="button"
                                onClick={handleSendLoginOtp}
                                disabled={isLoading}
                                className="mt-8 w-full py-3 px-4 text-sm font-semibold rounded-lg text-white bg-gradient-to-r from-teal-400 to-indigo-600 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {isLoading ? 'Sending OTP...' : 'Send OTP'}
                            </button>
                        ) : (
                            <button type="submit" disabled={isLoading || (authMode === 'signup' && (!!emailError || !!signupMobileError))} className="mt-8 w-full py-3 px-4 text-sm font-semibold rounded-lg text-white bg-gradient-to-r from-teal-400 to-indigo-600 shadow-md hover:shadow-lg transform hover:-translate-y-0.5 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed">
                                {isLoading ? 'Processing...' : (authMode === 'login' ? `Login` : 'Sign Up')}
                            </button>
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

        {/* Signup Verification Modal */}
        {signupStep !== 'form' && (
            <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4 backdrop-blur-sm">
                <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 w-full max-w-md relative">
                    <button 
                        onClick={() => { setSignupStep('form'); setConfirmationResult(null); setError(null); setIsLoading(false); }} 
                        className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:text-gray-300 dark:hover:text-gray-100"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                    </button>
                    
                    <h3 className="text-xl font-bold text-center text-gray-800 dark:text-white mb-2">Verify Your Identity</h3>
                    <p className="text-center text-gray-500 dark:text-gray-400 mb-6 text-sm">
                        Please verify your account to proceed with registration.
                    </p>

                    {signupStep === 'method_selection' && (
                        <div className="space-y-4">
                            <div id="recaptcha-container-signup"></div>
                            <button 
                                onClick={handleSignupSendOtp} 
                                disabled={isLoading}
                                className="w-full flex items-center justify-between p-4 bg-indigo-50 border border-indigo-100 rounded-xl hover:bg-indigo-100 transition-colors group dark:bg-indigo-900/20 dark:border-indigo-800 dark:hover:bg-indigo-900/40"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-indigo-600 text-white rounded-lg"><ChatBubbleLeftEllipsisIcon className="w-5 h-5" /></div>
                                    <div className="text-left">
                                        <p className="font-bold text-gray-800 dark:text-white text-sm">Verify via Mobile OTP</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Receive code on {signupMobile}</p>
                                    </div>
                                </div>
                                <span className="text-indigo-600 font-bold text-sm group-hover:translate-x-1 transition-transform dark:text-indigo-400">&rarr;</span>
                            </button>

                            <button 
                                onClick={handleDirectRegister} 
                                disabled={isLoading}
                                className="w-full flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors group dark:bg-gray-700 dark:border-gray-600 dark:hover:bg-gray-600"
                            >
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-gray-200 text-gray-600 rounded-lg dark:bg-gray-600 dark:text-gray-300"><EnvelopeIcon className="w-5 h-5" /></div>
                                    <div className="text-left">
                                        <p className="font-bold text-gray-800 dark:text-white text-sm">Verify via Email Link</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Send link to {email}</p>
                                    </div>
                                </div>
                                <span className="text-gray-400 font-bold text-sm group-hover:translate-x-1 transition-transform">&rarr;</span>
                            </button>
                        </div>
                    )}

                    {signupStep === 'otp_verification' && (
                        <div className="space-y-4 animate-fade-in-down">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Enter 6-digit OTP</label>
                                <input
                                    type="text"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value)}
                                    maxLength={6}
                                    placeholder="XXXXXX"
                                    className="block w-full text-center tracking-widest text-xl p-3 bg-gray-50 border border-gray-300 rounded-md shadow-sm focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                />
                            </div>
                            
                            <button 
                                onClick={handleSignupVerifyOtpAndRegister} 
                                disabled={isLoading}
                                className="w-full py-3 px-4 text-sm font-bold rounded-lg text-white bg-green-600 hover:bg-green-700 disabled:opacity-50 shadow-lg"
                            >
                                {isLoading ? 'Verifying...' : 'Verify & Create Account'}
                            </button>
                            
                            <button 
                                onClick={() => setSignupStep('method_selection')}
                                className="w-full text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400"
                            >
                                Change Method
                            </button>
                        </div>
                    )}
                    
                    {error && <div className="mt-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg text-center border border-red-100">{error}</div>}
                </div>
            </div>
        )}

        {showForgotPassword && <ForgotPasswordModal onClose={() => setShowForgotPassword(false)} platformSettings={platformSettings} />}
        {showStaffLogin && <StaffLoginModal onClose={() => setShowStaffLogin(false)} platformSettings={platformSettings} />}
    </>
  );
};

export default LoginPage;
