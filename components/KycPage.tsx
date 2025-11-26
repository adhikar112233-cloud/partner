
import React, { useState, useRef } from 'react';
import { User, KycDetails, PlatformSettings } from '../types';
import { apiService } from '../services/apiService';
import CameraCapture from './CameraCapture';
import { LogoIcon, ImageIcon, TrashIcon, CheckBadgeIcon } from './Icons';

interface KycPageProps {
    user: User;
    onKycSubmitted: () => void;
    isResubmit?: boolean;
    platformSettings: PlatformSettings;
}

const KycPage: React.FC<KycPageProps> = ({ user, onKycSubmitted, isResubmit = false, platformSettings }) => {
    const [mode, setMode] = useState<'options' | 'manual' | 'aadhaar_otp'>('options');
    const [formData, setFormData] = useState<KycDetails>(user.kycDetails || {});
    
    // Files
    const [idProofFile, setIdProofFile] = useState<File | null>(null);
    const [idProofPreview, setIdProofPreview] = useState<string | null>(user.kycDetails?.idProofUrl || null);
    const [selfieDataUrl, setSelfieDataUrl] = useState<string | null>(user.kycDetails?.selfieUrl || null);
    
    // Aadhaar OTP State
    const [aadhaarNumber, setAadhaarNumber] = useState('');
    const [aadhaarOtp, setAadhaarOtp] = useState('');
    const [aadhaarRefId, setAadhaarRefId] = useState('');
    const [otpSent, setOtpSent] = useState(false);

    // General State
    const [isLoading, setIsLoading] = useState(false);
    const [isLivenessVerified, setIsLivenessVerified] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const idProofRef = useRef<HTMLInputElement>(null);

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.[0]) {
            const file = e.target.files[0];
            setIdProofFile(file);
            setIdProofPreview(URL.createObjectURL(file));
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

    const sendAadhaarOtp = async () => {
        if(aadhaarNumber.length !== 12) { setError("Invalid Aadhaar Number"); return; }
        setIsLoading(true);
        try {
            const res = await apiService.verifyAadhaarOtp(aadhaarNumber);
            setAadhaarRefId(res.ref_id);
            setOtpSent(true);
            setError(null);
        } catch(e: any) { setError(e.message); }
        finally { setIsLoading(false); }
    };

    const verifyAadhaarOtp = async () => {
        setIsLoading(true);
        try {
            await apiService.verifyAadhaarSubmit(user.id, aadhaarOtp, aadhaarRefId);
            setSuccess("Aadhaar Verified Successfully!");
            setTimeout(onKycSubmitted, 2000);
        } catch(e: any) { setError(e.message); }
        finally { setIsLoading(false); }
    };

    const handleManualSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (platformSettings.isKycSelfieRequired && !isLivenessVerified) {
             setError("Please verify liveness on your selfie."); 
             return;
        }
        setIsLoading(true);
        try {
            await apiService.submitKyc(user.id, { ...formData, selfieUrl: selfieDataUrl }, idProofFile, null); 
            setSuccess("Submitted!");
            setTimeout(onKycSubmitted, 2000);
        } catch(e) { setError("Failed"); setIsLoading(false); }
    };

    return (
        <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 flex justify-center items-center">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8 w-full max-w-3xl">
                <div className="flex justify-center mb-6"><LogoIcon className="h-12 w-auto" /></div>
                <h2 className="text-2xl font-bold text-center dark:text-white mb-6">KYC Verification</h2>

                {mode === 'options' && (
                    <div className="space-y-4">
                        <button onClick={() => setMode('aadhaar_otp')} className="w-full py-4 bg-indigo-600 text-white rounded-xl font-bold shadow-lg hover:bg-indigo-700">
                            Instant Aadhaar Verification (Recommended)
                        </button>
                        <button onClick={() => setMode('manual')} className="w-full py-4 bg-gray-200 text-gray-800 rounded-xl font-bold hover:bg-gray-300 dark:bg-gray-700 dark:text-white">
                            Manual Upload (Passport/Voter ID)
                        </button>
                    </div>
                )}

                {mode === 'aadhaar_otp' && (
                    <div className="space-y-6">
                        {!otpSent ? (
                            <>
                                <input type="text" value={aadhaarNumber} onChange={e=>setAadhaarNumber(e.target.value)} placeholder="Enter 12-digit Aadhaar" className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:text-white" />
                                <button onClick={sendAadhaarOtp} disabled={isLoading} className="w-full py-3 bg-indigo-600 text-white rounded-lg font-bold">{isLoading ? 'Sending...' : 'Send OTP'}</button>
                            </>
                        ) : (
                            <>
                                <input type="text" value={aadhaarOtp} onChange={e=>setAadhaarOtp(e.target.value)} placeholder="Enter OTP" className="w-full p-3 border rounded-lg dark:bg-gray-700 dark:text-white" />
                                <button onClick={verifyAadhaarOtp} disabled={isLoading} className="w-full py-3 bg-green-600 text-white rounded-lg font-bold">{isLoading ? 'Verifying...' : 'Verify & Submit'}</button>
                            </>
                        )}
                        {error && <p className="text-red-500 text-center">{error}</p>}
                        {success && <p className="text-green-500 text-center">{success}</p>}
                        <button onClick={() => setMode('options')} className="text-sm text-gray-500 w-full text-center">Back</button>
                    </div>
                )}

                {mode === 'manual' && (
                    <form onSubmit={handleManualSubmit} className="space-y-6">
                        <div className="space-y-4">
                            <select name="idType" value={formData.idType} onChange={handleInputChange} className="w-full p-3 border rounded dark:bg-gray-700 dark:text-white">
                                <option value="">Select ID Type</option>
                                <option value="pan">PAN Card</option>
                                <option value="passport">Passport</option>
                                <option value="voter_id">Voter ID</option>
                            </select>
                            <input name="idNumber" placeholder="ID Number" value={formData.idNumber} onChange={handleInputChange} className="w-full p-3 border rounded dark:bg-gray-700 dark:text-white" />
                            
                            <div className="border-2 border-dashed p-4 rounded-lg text-center cursor-pointer" onClick={() => idProofRef.current?.click()}>
                                {idProofPreview ? <img src={idProofPreview} className="h-32 mx-auto" /> : <p>Upload ID Proof Front</p>}
                                <input type="file" hidden ref={idProofRef} onChange={handleFileChange} />
                            </div>
                        </div>
                        
                        {/* Liveness Selfie Section */}
                        <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-xl">
                            <h3 className="font-semibold mb-2 dark:text-white">Liveness Check</h3>
                            <CameraCapture 
                                capturedImage={selfieDataUrl} 
                                onCapture={setSelfieDataUrl} 
                                onRetake={() => { setSelfieDataUrl(null); setIsLivenessVerified(false); }}
                                selfieInstruction="Take a clear selfie." 
                            />
                            {selfieDataUrl && !isLivenessVerified && (
                                <button type="button" onClick={handleLivenessCheck} disabled={isLoading} className="mt-2 w-full py-2 bg-purple-600 text-white rounded-lg text-sm font-bold">
                                    {isLoading ? 'Checking...' : 'Verify Liveness'}
                                </button>
                            )}
                            {isLivenessVerified && <p className="text-green-600 font-bold text-center mt-2">✓ Liveness Verified</p>}
                        </div>

                        {error && <p className="text-red-500 text-center">{error}</p>}
                        <button type="submit" disabled={isLoading} className="w-full py-3 bg-indigo-600 text-white rounded-lg font-bold">Submit Documents</button>
                        <button type="button" onClick={() => setMode('options')} className="text-sm text-gray-500 w-full text-center">Back</button>
                    </form>
                )}
            </div>
        </div>
    );
};

export default KycPage;
