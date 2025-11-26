
import React, { useState, useRef } from 'react';
import { User, KycDetails, PlatformSettings } from '../types';
import { apiService } from '../services/apiService';
import CameraCapture from './CameraCapture';
import { LogoIcon, ImageIcon, CheckBadgeIcon, SparklesIcon } from './Icons';

interface KycPageProps {
    user: User;
    onKycSubmitted: () => void;
    isResubmit?: boolean;
    platformSettings: PlatformSettings;
}

const KycPage: React.FC<KycPageProps> = ({ user, onKycSubmitted, isResubmit = false, platformSettings }) => {
    const [mode, setMode] = useState<'options' | 'instant_options' | 'manual' | 'aadhaar_otp' | 'pan_verify' | 'dl_verify'>('options');
    const [formData, setFormData] = useState<KycDetails>(user.kycDetails || {});
    
    // Manual Files
    const [idProofFile, setIdProofFile] = useState<File | null>(null);
    const [idProofPreview, setIdProofPreview] = useState<string | null>(user.kycDetails?.idProofUrl || null);
    const [panFile, setPanFile] = useState<File | null>(null);
    const [panPreview, setPanPreview] = useState<string | null>(user.kycDetails?.panCardUrl || null);
    const [selfieDataUrl, setSelfieDataUrl] = useState<string | null>(user.kycDetails?.selfieUrl || null);
    
    // Aadhaar OTP State
    const [aadhaarNumber, setAadhaarNumber] = useState('');
    const [aadhaarOtp, setAadhaarOtp] = useState('');
    const [aadhaarRefId, setAadhaarRefId] = useState('');
    const [otpSent, setOtpSent] = useState(false);

    // PAN State
    const [panNumber, setPanNumber] = useState('');

    // Driving License State
    const [dlNumber, setDlNumber] = useState('');
    const [dob, setDob] = useState('');

    // General State
    const [isLoading, setIsLoading] = useState(false);
    const [isLivenessVerified, setIsLivenessVerified] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const idProofRef = useRef<HTMLInputElement>(null);
    const panFileRef = useRef<HTMLInputElement>(null);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'id' | 'pan') => {
        if (e.target.files?.[0]) {
            const file = e.target.files[0];
            if (type === 'id') {
                setIdProofFile(file);
                setIdProofPreview(URL.createObjectURL(file));
            } else {
                setPanFile(file);
                setPanPreview(URL.createObjectURL(file));
            }
        }
    };

    // Generic error handler to catch missing key errors from backend
    const handleApiError = (err: any) => {
        console.error(err);
        if (err.message && (err.message.includes("Server configuration error") || err.message.includes("Keys missing"))) {
            setError("System Error: Verification API keys are not configured. Please contact the administrator.");
        } else {
            setError(err.message || "An unknown error occurred.");
        }
        setIsLoading(false);
    };

    const handleLivenessCheck = async () => {
        if (!selfieDataUrl) {
            setError("Take a selfie first.");
            return;
        }
        setIsLoading(true);
        try {
            const result = await apiService.verifyLiveness(user.id, selfieDataUrl);
            if (result.success) {
                setIsLivenessVerified(true);
                setSuccess("Liveness Verified!");
                setTimeout(() => setSuccess(null), 3000);
            }
        } catch (err: any) {
            handleApiError(err);
        } finally {
            setIsLoading(false);
        }
    };

    // --- INSTANT: Aadhaar ---
    const sendAadhaarOtp = async () => {
        if(aadhaarNumber.length !== 12) { setError("Invalid Aadhaar Number"); return; }
        setIsLoading(true);
        setError(null);
        try {
            const res = await apiService.verifyAadhaarOtp(aadhaarNumber);
            setAadhaarRefId(res.ref_id);
            setOtpSent(true);
        } catch(e: any) { handleApiError(e); }
        finally { setIsLoading(false); }
    };

    const verifyAadhaarOtp = async () => {
        setIsLoading(true);
        setError(null);
        try {
            await apiService.verifyAadhaarSubmit(user.id, aadhaarOtp, aadhaarRefId);
            setSuccess("Aadhaar Verified Successfully!");
            setTimeout(onKycSubmitted, 2000);
        } catch(e: any) { handleApiError(e); }
        finally { setIsLoading(false); }
    };

    // --- INSTANT: PAN ---
    const verifyPan = async () => {
        if(panNumber.length !== 10) { setError("Invalid PAN Number"); return; }
        setIsLoading(true);
        setError(null);
        try {
            // Verify against the user's registered name
            const res = await apiService.verifyPan(user.id, panNumber, user.name);
            if (res.success) {
                setSuccess("PAN Verified Successfully!");
                setTimeout(onKycSubmitted, 2000);
            }
        } catch (e: any) {
            handleApiError(e);
        } finally {
            setIsLoading(false);
        }
    };

    // --- INSTANT: DL ---
    const verifyDl = async () => {
        if(!dlNumber || !dob) { setError("Please enter DL Number and Date of Birth."); return; }
        setIsLoading(true);
        setError(null);
        try {
            await apiService.verifyDrivingLicense(user.id, dlNumber, dob);
            setSuccess("Driving License Verified Successfully!");
            setTimeout(onKycSubmitted, 2000);
        } catch (e: any) {
            handleApiError(e);
        } finally {
            setIsLoading(false);
        }
    };

    // --- MANUAL SUBMISSION ---
    const handleManualSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        if (!idProofFile && !idProofPreview) { setError("ID Proof is required."); return; }
        if (!panFile && !panPreview) { setError("PAN Card photo is required."); return; }
        if (!selfieDataUrl) { setError("Selfie is required."); return; }
        
        if (platformSettings.isKycSelfieRequired && !isLivenessVerified) {
             setError("Please verify liveness on your selfie."); 
             return;
        }

        setIsLoading(true);
        try {
            await apiService.submitKyc(
                user.id, 
                { ...formData, selfieUrl: selfieDataUrl }, 
                idProofFile, 
                null, 
                panFile // Pass PAN file
            ); 
            setSuccess("Submitted! Waiting for admin approval.");
            setTimeout(onKycSubmitted, 2000);
        } catch(e: any) { 
            handleApiError(e);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 flex justify-center items-center">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 w-full max-w-3xl transition-all duration-300">
                <div className="flex justify-center mb-6">
                    <LogoIcon className="h-12 w-auto" />
                </div>
                
                <h2 className="text-2xl font-bold text-center text-gray-800 dark:text-white mb-2">
                    {isResubmit ? 'Resubmit Verification' : 'Identity Verification'}
                </h2>
                
                <p className="text-center text-gray-500 dark:text-gray-400 mb-8">
                    {mode === 'options' 
                        ? 'Select verification mode' 
                        : mode === 'instant_options' 
                            ? 'Choose a document for instant verification'
                            : 'Enter details accurately to avoid rejection'
                    }
                </p>

                {/* Root Options */}
                {mode === 'options' && (
                    <div className="space-y-6 animate-fade-in-down">
                        {platformSettings.isInstantKycEnabled && (
                            <button onClick={() => setMode('instant_options')} className="w-full flex items-center justify-between p-6 bg-gradient-to-r from-indigo-50 to-blue-50 border border-indigo-100 rounded-xl hover:shadow-md transition-all group dark:from-indigo-900/20 dark:to-blue-900/20 dark:border-indigo-800">
                                <div className="flex items-center space-x-4">
                                    <div className="p-3 bg-indigo-600 text-white rounded-xl"><SparklesIcon className="w-8 h-8" /></div>
                                    <div className="text-left">
                                        <p className="font-bold text-lg text-gray-800 dark:text-white">Instant Verification</p>
                                        <p className="text-sm text-gray-500 dark:text-gray-400">Verify using Aadhaar, PAN, or Driving License instantly.</p>
                                    </div>
                                </div>
                                <span className="text-indigo-600 font-bold group-hover:translate-x-1 transition-transform dark:text-indigo-400">&rarr;</span>
                            </button>
                        )}

                        <button onClick={() => setMode('manual')} className="w-full flex items-center justify-between p-6 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-all group dark:bg-gray-800 dark:border-gray-600 dark:hover:bg-gray-700">
                            <div className="flex items-center space-x-4">
                                <div className="p-3 bg-gray-200 text-gray-600 rounded-xl dark:bg-gray-700 dark:text-gray-300">
                                    <ImageIcon className="w-8 h-8" />
                                </div>
                                <div className="text-left">
                                    <p className="font-bold text-lg text-gray-800 dark:text-gray-100">Manual Verification</p>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">Upload documents manually. Takes 24-48 hours.</p>
                                </div>
                            </div>
                            <span className="text-gray-400 font-bold group-hover:translate-x-1 transition-transform">&rarr;</span>
                        </button>
                    </div>
                )}

                {/* Instant Options Selection */}
                {mode === 'instant_options' && (
                    <div className="space-y-4 animate-fade-in-down">
                        <button onClick={() => setMode('aadhaar_otp')} className="w-full flex items-center justify-between p-4 bg-indigo-50 border border-indigo-100 rounded-xl hover:bg-indigo-100 transition-colors dark:bg-indigo-900/20 dark:border-indigo-800 dark:hover:bg-indigo-900/40">
                            <div className="flex items-center space-x-3">
                                <CheckBadgeIcon className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                                <span className="font-semibold text-gray-800 dark:text-white">Aadhaar Card (OTP)</span>
                            </div>
                            <span className="text-gray-400 text-sm">Fastest</span>
                        </button>

                        <button onClick={() => setMode('pan_verify')} className="w-full flex items-center justify-between p-4 bg-teal-50 border border-teal-100 rounded-xl hover:bg-teal-100 transition-colors dark:bg-teal-900/20 dark:border-teal-800 dark:hover:bg-teal-900/40">
                            <div className="flex items-center space-x-3">
                                <CheckBadgeIcon className="w-6 h-6 text-teal-600 dark:text-teal-400" />
                                <span className="font-semibold text-gray-800 dark:text-white">PAN Card</span>
                            </div>
                            <span className="text-gray-400 text-sm">Name Match</span>
                        </button>

                        <button onClick={() => setMode('dl_verify')} className="w-full flex items-center justify-between p-4 bg-blue-50 border border-blue-100 rounded-xl hover:bg-blue-100 transition-colors dark:bg-blue-900/20 dark:border-blue-800 dark:hover:bg-blue-900/40">
                            <div className="flex items-center space-x-3">
                                <CheckBadgeIcon className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                                <span className="font-semibold text-gray-800 dark:text-white">Driving License</span>
                            </div>
                            <span className="text-gray-400 text-sm">ID Verification</span>
                        </button>

                        <button onClick={() => setMode('options')} className="w-full py-2 text-sm text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 mt-4">
                            &larr; Back to Methods
                        </button>
                    </div>
                )}

                {/* Instant: Aadhaar */}
                {mode === 'aadhaar_otp' && (
                    <div className="space-y-6 animate-fade-in-down">
                        <div className="text-center p-4 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg">
                            <h3 className="text-lg font-bold text-indigo-700 dark:text-indigo-300">Aadhaar OTP</h3>
                            <p className="text-xs text-gray-600 dark:text-gray-300">We'll send an OTP to your Aadhaar-linked mobile.</p>
                        </div>
                        {!otpSent ? (
                            <div className="space-y-4">
                                <input type="text" value={aadhaarNumber} onChange={e=>setAadhaarNumber(e.target.value)} placeholder="Enter 12-digit Aadhaar Number" className="w-full p-3 border border-gray-300 rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white text-center font-mono text-lg focus:ring-2 focus:ring-indigo-500 outline-none transition-all" maxLength={12} />
                                <button onClick={sendAadhaarOtp} disabled={isLoading} className="w-full py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50 shadow-lg transform hover:-translate-y-0.5 transition-all">
                                    {isLoading ? 'Sending OTP...' : 'Send OTP'}
                                </button>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <input type="text" value={aadhaarOtp} onChange={e=>setAadhaarOtp(e.target.value)} placeholder="Enter 6-digit OTP" className="w-full p-3 border border-gray-300 rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white text-center font-mono text-lg focus:ring-2 focus:ring-green-500 outline-none transition-all" maxLength={6} />
                                <button onClick={verifyAadhaarOtp} disabled={isLoading} className="w-full py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 disabled:opacity-50 shadow-lg transform hover:-translate-y-0.5 transition-all">
                                    {isLoading ? 'Verifying...' : 'Verify & Submit'}
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {/* Instant: PAN */}
                {mode === 'pan_verify' && (
                    <div className="space-y-6 animate-fade-in-down">
                        <div className="text-center p-4 bg-teal-50 dark:bg-teal-900/20 rounded-lg">
                            <h3 className="text-lg font-bold text-teal-700 dark:text-teal-300">PAN Validation</h3>
                            <p className="text-xs text-gray-600 dark:text-gray-300">Ensure the name matches your profile: <strong>{user.name}</strong></p>
                        </div>
                        
                        <input type="text" value={panNumber} onChange={e=>setPanNumber(e.target.value.toUpperCase())} placeholder="Enter PAN Number (e.g. ABCDE1234F)" className="w-full p-3 border border-gray-300 rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white text-center font-mono text-lg uppercase focus:ring-2 focus:ring-teal-500 outline-none transition-all" maxLength={10} />
                        
                        <button onClick={verifyPan} disabled={isLoading} className="w-full py-3 bg-teal-600 text-white rounded-lg font-bold hover:bg-teal-700 disabled:opacity-50 shadow-lg transform hover:-translate-y-0.5 transition-all">
                            {isLoading ? 'Verifying...' : 'Verify PAN'}
                        </button>
                    </div>
                )}

                {/* Instant: DL */}
                {mode === 'dl_verify' && (
                    <div className="space-y-6 animate-fade-in-down">
                        <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
                            <h3 className="text-lg font-bold text-blue-700 dark:text-blue-300">Driver's License</h3>
                            <p className="text-xs text-gray-600 dark:text-gray-300">Match your DL details exactly.</p>
                        </div>
                        
                        <div className="space-y-4">
                            <input type="text" value={dlNumber} onChange={e=>setDlNumber(e.target.value)} placeholder="DL Number" className="w-full p-3 border border-gray-300 rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white font-mono focus:ring-2 focus:ring-blue-500 outline-none" />
                            <input type="date" value={dob} onChange={e=>setDob(e.target.value)} placeholder="Date of Birth" className="w-full p-3 border border-gray-300 rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none" />
                        </div>
                        
                        <button onClick={verifyDl} disabled={isLoading} className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50 shadow-lg transform hover:-translate-y-0.5 transition-all">
                            {isLoading ? 'Verifying...' : 'Verify DL'}
                        </button>
                    </div>
                )}

                {/* Manual Upload */}
                {mode === 'manual' && (
                    <form onSubmit={handleManualSubmit} className="space-y-6 max-h-[60vh] overflow-y-auto pr-2 animate-fade-in-down">
                        <h3 className="text-lg font-bold text-gray-700 dark:text-gray-200 border-b pb-2">1. ID Proof</h3>
                        <div className="space-y-4">
                            <select name="idType" value={formData.idType} onChange={handleInputChange} className="w-full p-3 border rounded dark:bg-gray-700 dark:text-white" required>
                                <option value="">Select ID Type</option>
                                <option value="aadhaar">Aadhaar Card</option>
                                <option value="voter_id">Voter ID</option>
                                <option value="passport">Passport</option>
                                <option value="driving_license">Driving License</option>
                            </select>
                            <input name="idNumber" placeholder="Enter ID Document Number" value={formData.idNumber} onChange={handleInputChange} className="w-full p-3 border rounded dark:bg-gray-700 dark:text-white" required />
                            
                            <div className="border-2 border-dashed p-4 rounded-lg text-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors" onClick={() => idProofRef.current?.click()}>
                                {idProofPreview ? (
                                    <div className="relative">
                                        <img src={idProofPreview} className="h-32 mx-auto rounded object-contain" alt="ID Proof" />
                                        <p className="text-xs text-gray-500 mt-2">Change ID Photo</p>
                                    </div>
                                ) : (
                                    <>
                                        <ImageIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                                        <p className="text-gray-600 dark:text-gray-300 text-sm">Upload ID Proof Photo</p>
                                    </>
                                )}
                                <input type="file" hidden ref={idProofRef} onChange={(e) => handleFileChange(e, 'id')} accept="image/*" />
                            </div>
                        </div>

                        <h3 className="text-lg font-bold text-gray-700 dark:text-gray-200 border-b pb-2">2. PAN Card</h3>
                        <div className="space-y-4">
                             <div className="border-2 border-dashed p-4 rounded-lg text-center cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors" onClick={() => panFileRef.current?.click()}>
                                {panPreview ? (
                                    <div className="relative">
                                        <img src={panPreview} className="h-32 mx-auto rounded object-contain" alt="PAN Card" />
                                        <p className="text-xs text-gray-500 mt-2">Change PAN Photo</p>
                                    </div>
                                ) : (
                                    <>
                                        <ImageIcon className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                                        <p className="text-gray-600 dark:text-gray-300 text-sm">Upload PAN Card Photo</p>
                                    </>
                                )}
                                <input type="file" hidden ref={panFileRef} onChange={(e) => handleFileChange(e, 'pan')} accept="image/*" />
                            </div>
                        </div>
                        
                        <h3 className="text-lg font-bold text-gray-700 dark:text-gray-200 border-b pb-2">3. Live Selfie</h3>
                        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-xl border border-gray-200 dark:border-gray-600">
                            <CameraCapture 
                                capturedImage={selfieDataUrl} 
                                onCapture={setSelfieDataUrl} 
                                onRetake={() => { setSelfieDataUrl(null); setIsLivenessVerified(false); }}
                                selfieInstruction="Take a clear selfie to prove you are human." 
                            />
                            {selfieDataUrl && !isLivenessVerified && (
                                <button type="button" onClick={handleLivenessCheck} disabled={isLoading} className="mt-3 w-full py-2 bg-purple-600 text-white rounded-lg text-sm font-bold hover:bg-purple-700 disabled:opacity-50">
                                    {isLoading ? 'Analyzing...' : 'Verify Liveness'}
                                </button>
                            )}
                            {isLivenessVerified && <p className="text-green-600 font-bold text-center mt-2 flex items-center justify-center gap-2"><CheckBadgeIcon className="w-5 h-5"/> Liveness Verified</p>}
                        </div>

                        <div className="flex flex-col gap-2 pt-4">
                            <button type="submit" disabled={isLoading} className="w-full py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed shadow-md">
                                {isLoading ? 'Submitting...' : 'Submit Documents'}
                            </button>
                        </div>
                    </form>
                )}

                {error && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg animate-fade-in-down">
                        <p className="text-red-700 text-sm text-center font-medium">{error}</p>
                    </div>
                )}
                
                {success && (
                    <div className="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg animate-fade-in-down">
                        <p className="text-green-700 text-sm text-center font-bold">{success}</p>
                    </div>
                )}

                {mode !== 'options' && mode !== 'instant_options' && (
                    <button 
                        onClick={() => { setMode('options'); setError(null); setSuccess(null); }} 
                        className="mt-4 w-full py-2 text-sm text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 font-medium"
                    >
                        Cancel & Go Back
                    </button>
                )}
            </div>
        </div>
    );
};

export default KycPage;
