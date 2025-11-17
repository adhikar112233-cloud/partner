import React, { useState } from 'react';
import { authService } from '../services/authService';
import { AdminIcon, ExclamationTriangleIcon } from './Icons';
import { PlatformSettings } from '../types';
import { firebaseConfig } from '../services/firebase';

interface StaffLoginModalProps {
    onClose: () => void;
    platformSettings: PlatformSettings;
}

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


const StaffLoginModal: React.FC<StaffLoginModalProps> = ({ onClose, platformSettings }) => {
    const [mode, setMode] = useState<'login' | 'signup'>('login');
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setIsLoading(true);

        if (mode === 'signup' && password !== confirmPassword) {
            setError("Passwords do not match.");
            setIsLoading(false);
            return;
        }

        try {
            if (mode === 'login') {
                await authService.login(email, password);
            } else {
                await authService.register(email, password, 'staff', name, '', '');
            }
            onClose();
        } catch (err: any) {
            if (err.code === 'auth/unauthorized-domain' || err.code === 'auth/network-request-failed') {
                setError('auth/unauthorized-domain');
            } else if (err.code === 'auth/auth-domain-config-required') {
                setError('auth/auth-domain-config-required');
            } else if (err.code === 'auth/internal-error') {
                setError('auth/internal-error');
            } else if (mode === 'login' && err.code === 'auth/invalid-credential') {
                setError('Invalid staff credentials. Please try again.');
            } else if (mode === 'signup' && err.code === 'auth/email-already-in-use') {
                setError('This email is already registered.');
            } else {
                console.error("Staff auth error:", err);
                setError('An unexpected error occurred. Please try again later.');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const toggleMode = () => {
        setMode(prev => (prev === 'login' ? 'signup' : 'login'));
        setError(null);
        setName('');
        setEmail('');
        setPassword('');
        setConfirmPassword('');
    }

    const renderError = () => {
        if (!error) return null;
    
        let title = "Authentication Error";
        let content: React.ReactNode = <p>{error}</p>;
    
        if (error === 'auth/unauthorized-domain') {
            title = "Action Required: Authorize Domain";
            content = (
                <>
                    <p>Firebase authentication requires this app's domain to be on an allowlist for security. This is a one-time setup for this preview URL.</p>
                    <ol className="list-decimal list-inside space-y-2 mt-3 text-sm">
                        <li>
                            <strong>Go to Auth Settings:</strong>
                            <a 
                                href={`https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/settings/domains`} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="ml-2 font-medium text-indigo-600 dark:text-indigo-400 underline hover:text-indigo-800 dark:hover:text-indigo-300"
                            >
                                Click to open "Authorized domains"
                            </a>
                        </li>
                        <li>
                            <strong>Add Domain:</strong> On the Firebase page, click <strong>"Add domain"</strong>.
                        </li>
                        <li>
                            <strong>Copy & Paste:</strong> Copy the domain below and paste it into the Firebase dialog.
                        </li>
                    </ol>
                    <CopyableInput value={window.location.hostname} />
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">After adding the domain, you can try again. If it fails, a full page refresh might be needed.</p>
                </>
            );
        } else if (error === 'auth/internal-error') {
            title = "Internal Auth Error";
            content = (
                <p>Please check your Firebase project configuration. Ensure the 'Email/Password' sign-in provider is enabled.</p>
            );
        } else if (error === 'auth/auth-domain-config-required') {
            title = "Auth Domain Missing";
            content = <p>The Firebase 'authDomain' is missing from your configuration. Please check <code>services/firebase.ts</code>.</p>;
        }
    
        return (
             <div className="mt-4 text-left bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border-l-4 border-red-500 dark:border-red-600">
                <h3 className="font-bold text-red-800 dark:text-red-200 mb-2 flex items-center gap-2">
                    <ExclamationTriangleIcon className="w-5 h-5 flex-shrink-0" />
                    {title}
                </h3>
                <div className="text-red-700 dark:text-red-300 text-sm space-y-2 pl-7">{content}</div>
            </div>
        );
    };


    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 w-full max-w-sm relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:text-gray-300 dark:hover:text-gray-100">
                     <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </button>

                <div className="text-center">
                    <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-indigo-100 dark:bg-gray-700">
                        <AdminIcon className="h-6 w-6 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <h2 className="mt-4 text-xl font-bold text-gray-800 dark:text-gray-100">{mode === 'login' ? 'Staff Login' : 'Create Staff Account'}</h2>
                    <p className="text-sm text-gray-500 dark:text-gray-400">For internal use only.</p>
                </div>
                
                <form onSubmit={handleSubmit} className="mt-8 space-y-6">
                    {mode === 'signup' && (
                        <div>
                            <label htmlFor="staff-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Full Name</label>
                            <input 
                                type="text" 
                                id="staff-name" 
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                placeholder="Jane Doe"
                                className="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" 
                                required 
                            />
                        </div>
                    )}
                    <div>
                        <label htmlFor="staff-email" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Staff Email</label>
                        <input 
                            type="email" 
                            id="staff-email" 
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="staff.member@bigyapon.com"
                            className="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" 
                            required 
                        />
                    </div>
                     <div>
                        <label htmlFor="staff-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
                        <input 
                            type="password" 
                            id="staff-password" 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" 
                            required 
                        />
                    </div>
                    {mode === 'signup' && (
                         <div>
                            <label htmlFor="staff-confirm-password" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Confirm Password</label>
                            <input 
                                type="password" 
                                id="staff-confirm-password" 
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                className="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" 
                                required 
                            />
                        </div>
                    )}

                    {renderError()}

                    <button 
                        type="submit" 
                        disabled={isLoading}
                        className="w-full py-2 px-4 text-sm font-semibold rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50"
                    >
                       {isLoading ? 'Processing...' : (mode === 'login' ? 'Login' : 'Create Account')}
                    </button>
                </form>
                 <div className="text-center text-sm mt-4">
                    <button onClick={toggleMode} className="font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 dark:hover:text-indigo-300">
                        {mode === 'login' ? 'Create a staff account' : 'Already have an account? Login'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default StaffLoginModal;