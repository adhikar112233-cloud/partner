
import React, { useState, useRef } from 'react';
import { User, KycDetails, PlatformSettings } from '../types';
import { apiService } from '../services/apiService';
import CameraCapture from './CameraCapture';
import { LogoIcon, ImageIcon, CheckBadgeIcon } from './Icons';

interface KycPageProps {
    user: User;
    onKycSubmitted: () => void;
    isResubmit?: boolean;
    platformSettings: PlatformSettings;
}

const KycPage: React.FC<KycPageProps> = ({ user, onKycSubmitted, isResubmit = false, platformSettings }) => {
    const [mode, setMode] = useState<'options' | 'manual' | 'aadhaar_otp' | 'pan_verify' | 'dl_verify'>('options');
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
                alert("Liveness Verified! You are a real person.");
            }
        } catch (err: any) {
            setError(err.message);
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
        } catch(e: any) { setError(e.message); }
        finally { setIsLoading(false); }
    };

    const verifyAadhaarOtp = async () => {
        setIsLoading(true);
        setError(null);
        try {
            await apiService.verifyAadhaarSubmit(user.id, aadhaarOtp, aadhaarRefId);
            setSuccess("Aadhaar Verified Successfully!");
            setTimeout(onKycSubmitted, 2000);
        } catch(e: any) { setError(e.message); }
        finally { setIsLoading(false); }
    };

    // --- INSTANT: PAN ---
    const verifyPan = async () => {
        if(panNumber.length !== 10) { setError("Invalid PAN Number"); return; }
        setIsLoading(true);
        setError(null);
        try {
            // Verify against the user's registered name
            await apiService.verifyPan(user.id, panNumber, user.name);
            setSuccess("PAN Verified Successfully!");
            setTimeout(onKycSubmitted, 2000);
        } catch (e: any) {
            setError(e.message || "PAN Verification Failed");
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
            setError(e.message || "DL Verification Failed");
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
        } catch(e) { 
            console.error(e);
            setError("Failed to submit documents."); 
            setIsLoading(false); 
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 flex justify-center items-center">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 w-full max-w-3xl">
                <div className="flex justify-center mb-6"><LogoIcon className="h-12 w-auto" /></div>
                <h2 className="text-2xl font-bold text-center dark:text-white mb-2">Complete Verification</h2>
                <p className="text-center text-gray-500 dark:text-gray-400 mb-8">Select a method to verify your identity</p>

                {mode === 'options' && (
                    <div className="space-y-6">
                        {platformSettings.isInstantKycEnabled && (
                            <div className="space-y-3">
                                <p className="text-sm font-bold text-gray-400 uppercase tracking-wide">Instant Verification (Fastest)</p>
                                
                                <button onClick={() => setMode('aadhaar_otp')} className="w-full flex items-center justify-between p-4 bg-indigo-50 border border-indigo-100 rounded-xl hover:bg-indigo-100 transition-colors group">
                                    <div className="flex items-center space-x-4">
                                        <div className="p-2 bg-indigo-600 text-white rounded-lg"><CheckBadgeIcon className="w-6 h-6" /></div>
                                        <div className="text-left">
                                            <p className="font-bold text-gray-800">Aadhaar Card</p>
                                            <p className="text-xs text-gray-500">Verify via OTP</p>
                                        </div>
                                    </div>
                                    <span className="text-indigo-600 font-bold group-hover:translate-x-1 transition-transform">&rarr;</span>
                                </button>

                                <button onClick={() => setMode('pan_verify')} className="w-full flex items-center justify-between p-4 bg-teal-50 border border-teal-100 rounded-xl hover:bg-teal-100 transition-colors group">
                                    <div className="flex items-center space-x-4">
                                        <div className="p-2 bg-teal-600 text-white rounded-lg"><CheckBadgeIcon className="w-6 h-6" /></div>
                                        <div className="text-left">
                                            <p className="font-bold text-gray-800">PAN Card</p>
                                            <p className="text-xs text-gray-500">Verify Instantly</p>
                                        </div>
                                    </div>
                                    <span className="text-teal-600 font-bold group-hover:translate-x-1 transition-transform">&rarr;</span>
                                </button>

                                <button onClick={() => setMode('dl_verify')} className="w-full flex items-center justify-between p-4 bg-blue-50 border border-blue-100 rounded-xl hover:bg-blue-100 transition-colors group">
                                    <div className="flex items-center space-x-4">
                                        <div className="p-2 bg-blue-600 text-white rounded-lg"><CheckBadgeIcon className="w-6 h-6" /></div>
                                        <div className="text-left">
                                            <p className="font-bold text-gray-800">Driving License</p>
                                            <p className="text-xs text-gray-500">Verify Instantly</p>
                                        </div>
                                    </div>
                                    <span className="text-blue-600 font-bold group-hover:translate-x-1 transition-transform">&rarr;</span>
                                </button>
                            </div>
                        )}

                        <div className="space-y-3">
                            <p className="text-sm font-bold text-gray-400 uppercase tracking-wide">Manual Verification (Takes 24-48h)</p>
                            <button onClick={() => setMode('manual')} className="w-full flex items-center justify-between p-4 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors dark:bg-gray-700 dark:border-gray-600 dark:hover:bg-gray-600">
                                <div className="flex items-center space-x-4">
                                    <div className="p-2 bg-gray-200 text-gray-600 rounded-lg dark:bg-gray-600 dark:text-gray-300">
                                        <ImageIcon className="w-6 h-6" />
                                    </div>
                                    <div className="text-left">
                                        <p className="font-bold text-gray-800 dark:text-gray-100">Upload Documents</p>
                                        <p className="text-xs text-gray-500 dark:text-gray-400">Passport, Voter ID, etc.</p>
                                    </div>
                                </div>
                                <span className="text-gray-400 font-bold">&rarr;</span>
                            </button>
                        </div>
                    </div>
                )}

                {/* Instant: Aadhaar */}
                {mode === 'aadhaar_otp' && (
                    <div className="space-y-6">
                        <div className="text-center">
                            <h3 className="text-xl font-bold text-indigo-600">Aadhaar Verification</h3>
                            <p className="text-sm text-gray-500">Enter your Aadhaar number to receive an OTP.</p>
                        </div>
                        {!otpSent ? (
                            <>
                                <input type="text" value={aadhaarNumber} onChange={e=>setAadhaarNumber(e.target.value)} placeholder="Enter 12-digit Aadhaar Number" className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:text-white text-center font-mono text-lg" maxLength={12} />
                                <button onClick={sendAadhaarOtp} disabled={isLoading} className="w-full py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50">{isLoading ? 'Sending...' : 'Send OTP'}</button>
                            </>
                        ) : (
                            <>
                                <input type="text" value={aadhaarOtp} onChange={e=>setAadhaarOtp(e.target.value)} placeholder="Enter OTP" className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:text-white text-center font-mono text-lg" maxLength={6} />
                                <button onClick={verifyAadhaarOtp} disabled={isLoading} className="w-full py-3 bg-green-600 text-white rounded-lg font-bold hover:bg-green-700 disabled:opacity-50">{isLoading ? 'Verifying...' : 'Verify & Submit'}</button>
                            </>
                        )}
                        {error && <p className="text-red-500 text-center bg-red-50 p-2 rounded">{error}</p>}
                        <button onClick={() => setMode('options')} className="text-sm text-gray-500 w-full text-center hover:underline">Cancel</button>
                    </div>
                )}

                {/* Instant: PAN */}
                {mode === 'pan_verify' && (
                    <div className="space-y-6">
                        <div className="text-center">
                            <h3 className="text-xl font-bold text-teal-600">PAN Verification</h3>
                            <p className="text-sm text-gray-500">Instant Name Match Verification.</p>
                        </div>
                        
                        <input type="text" value={panNumber} onChange={e=>setPanNumber(e.target.value.toUpperCase())} placeholder="Enter PAN Number (e.g. ABCDE1234F)" className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:text-white text-center font-mono text-lg uppercase" maxLength={10} />
                        <button onClick={verifyPan} disabled={isLoading} className="w-full py-3 bg-teal-600 text-white rounded-lg font-bold hover:bg-teal-700 disabled:opacity-50">{isLoading ? 'Verifying...' : 'Verify Now'}</button>
                        
                        {error && <p className="text-red-500 text-center bg-red-50 p-2 rounded">{error}</p>}
                        <button onClick={() => setMode('options')} className="text-sm text-gray-500 w-full text-center hover:underline">Cancel</button>
                    </div>
                )}

                {/* Instant: DL */}
                {mode === 'dl_verify' && (
                    <div className="space-y-6">
                        <div className="text-center">
                            <h3 className="text-xl font-bold text-blue-600">Driving License Verification</h3>
                            <p className="text-sm text-gray-500">Enter details as per your license.</p>
                        </div>
                        
                        <input type="text" value={dlNumber} onChange={e=>setDlNumber(e.target.value)} placeholder="DL Number" className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:text-white font-mono" />
                        <input type="date" value={dob} onChange={e=>setDob(e.target.value)} placeholder="Date of Birth" className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:text-white" />
                        
                        <button onClick={verifyDl} disabled={isLoading} className="w-full py-3 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 disabled:opacity-50">{isLoading ? 'Verifying...' : 'Verify Now'}</button>
                        
                        {error && <p className="text-red-500 text-center bg-red-50 p-2 rounded">{error}</p>}
                        <button onClick={() => setMode('options')} className="text-sm text-gray-500 w-full text-center hover:underline">Cancel</button>
                    </div>
                )}

                {/* Manual Upload */}
                {mode === 'manual' && (
                    <form onSubmit={handleManualSubmit} className="space-y-6 max-h-[70vh] overflow-y-auto pr-2">
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
                                        <img src={idProofPreview} className="h-32 mx-auto rounded object-contain" />
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
                                        <img src={panPreview} className="h-32 mx-auto rounded object-contain" />
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

                        {error && <p className="text-red-500 text-center bg-red-50 p-2 rounded">{error}</p>}
                        <div className="flex flex-col gap-2">
                            <button type="submit" disabled={isLoading} className="w-full py-3 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed">Submit Documents</button>
                            <button type="button" onClick={() => setMode('options')} className="text-sm text-gray-500 w-full text-center hover:underline">Back</button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
};

export default KycPage;
