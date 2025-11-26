
import React, { useState, useRef } from 'react';
import { User, KycDetails, PlatformSettings } from '../types';
import { apiService } from '../services/apiService';
import CameraCapture from './CameraCapture';
import { LogoIcon, ImageIcon, TrashIcon } from './Icons';

interface KycPageProps {
    user: User;
    onKycSubmitted: () => void;
    isResubmit?: boolean;
    platformSettings: PlatformSettings;
}

const indianStates = ["Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh", "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand", "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur", "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab", "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura", "Uttar Pradesh", "Uttarakhand", "West Bengal"];

const KycPage: React.FC<KycPageProps> = ({ user, onKycSubmitted, isResubmit = false, platformSettings }) => {
    const [mode, setMode] = useState<'options' | 'manual' | 'digilocker'>('options');
    const [formData, setFormData] = useState<KycDetails>(user.kycDetails || {});
    const [idProofFile, setIdProofFile] = useState<File | null>(null);
    const [idProofPreview, setIdProofPreview] = useState<string | null>(user.kycDetails?.idProofUrl || null);
    const [selfieDataUrl, setSelfieDataUrl] = useState<string | null>(user.kycDetails?.selfieUrl || null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const idProofRef = useRef<HTMLInputElement>(null);
    const [isPopupOpen, setIsPopupOpen] = useState(false);

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
    
    const removeIdProof = () => {
        setIdProofFile(null);
        setIdProofPreview(null);
        if(idProofRef.current) idProofRef.current.value = '';
    };
    
    const dataURLtoFile = (dataurl: string, filename: string): File => {
        const arr = dataurl.split(',');
        const mimeMatch = arr[0].match(/:(.*?);/);
        if (!mimeMatch) {
            throw new Error('Invalid data URL format');
        }
        const mime = mimeMatch[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while(n--){
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new File([u8arr], filename, {type:mime});
    }

    const handleManualSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccess(null);

        if (platformSettings.isKycIdProofRequired && !idProofFile && !user.kycDetails?.idProofUrl) {
            setError("ID proof is required.");
            return;
        }
        if (platformSettings.isKycSelfieRequired && !selfieDataUrl && !user.kycDetails?.selfieUrl) {
            setError("A live selfie is required.");
            return;
        }

        setIsLoading(true);
        try {
            const selfieFile = (selfieDataUrl && selfieDataUrl !== user.kycDetails?.selfieUrl) ? dataURLtoFile(selfieDataUrl, 'selfie.jpg') : null;
            
            // If we have a new file, use it. If not, the API service will keep the old one if we pass the existing kycDetails in formData.
            // However, apiService.submitKyc merges data.
            
            await apiService.submitKyc(user.id, formData, idProofFile, selfieFile);
            
            setSuccess("KYC details submitted successfully! An admin will verify your documents shortly.");
            
            setTimeout(() => {
                onKycSubmitted();
            }, 3000);

        } catch (err: any) {
            console.error(err);
            let errorMessage = "Failed to submit KYC. Please try again.";
            if (err.code === 'storage/unauthorized') errorMessage = "Storage permission error.";
            setError(errorMessage);
            setIsLoading(false); 
        }
    };
    
    const handleDigilockerSubmit = () => {
        // Open the internal Mock Page
        const mockUrl = window.location.origin + `/mock-digilocker?userId=${user.id}`;
        const popup = window.open(mockUrl, 'digilockerMock', 'width=500,height=700');
        setIsPopupOpen(true);

        const checkPopup = setInterval(() => {
            if (!popup || popup.closed) {
                clearInterval(checkPopup);
                setIsPopupOpen(false);
                
                setIsLoading(true);
                setTimeout(() => {
                    onKycSubmitted(); 
                    setIsLoading(false);
                }, 1500);
            }
        }, 1000);
    };

    const renderOptions = () => (
         <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">KYC Verification</h2>
            <p className="mt-2 text-gray-600 dark:text-gray-300">Verify your identity to unlock all features.</p>
            {isResubmit && user.kycDetails?.rejectionReason && (
                 <div className="mt-4 p-4 bg-red-50 text-red-700 border border-red-200 rounded-lg text-left dark:bg-red-900/20 dark:text-red-300 dark:border-red-700 shadow-sm">
                    <p className="font-bold flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>
                        Previous Submission Rejected
                    </p>
                    <p className="text-sm mt-1">Reason: {user.kycDetails.rejectionReason}</p>
                 </div>
            )}
            <div className="mt-8 space-y-4 max-w-md mx-auto">
                <button onClick={() => setMode('manual')} className="w-full py-4 px-6 text-lg font-semibold rounded-xl text-white bg-gradient-to-r from-indigo-600 to-purple-600 shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all">
                    Upload Documents (Manual Verification)
                </button>
                
                {platformSettings.isDigilockerKycEnabled && (
                    <>
                        <div className="relative flex py-2 items-center">
                            <div className="flex-grow border-t border-gray-300 dark:border-gray-600"></div>
                            <span className="flex-shrink-0 mx-4 text-gray-400 text-sm">OR</span>
                            <div className="flex-grow border-t border-gray-300 dark:border-gray-600"></div>
                        </div>
                        <button onClick={handleDigilockerSubmit} disabled={isLoading || isPopupOpen} className="w-full py-3 px-4 text-base font-medium rounded-lg text-gray-700 bg-white border border-gray-300 hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-200 dark:border-gray-600 dark:hover:bg-gray-700 shadow-sm transition-all">
                            {isLoading ? 'Checking Status...' : isPopupOpen ? 'Continue in Popup...' : 'Instant KYC with DigiLocker'}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
    
    const renderManualForm = () => (
        <form onSubmit={handleManualSubmit} className="space-y-6">
            <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Manual Verification</h2>
                <p className="text-sm text-gray-500 dark:text-gray-400">An admin will review your details and documents.</p>
            </div>
            
            <div className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-gray-700 dark:text-gray-200 mb-3">Personal Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Full Name</label>
                        <input type="text" value={user.name} disabled className="mt-1 w-full p-2 bg-gray-200 border border-gray-300 rounded-md text-gray-600 cursor-not-allowed dark:bg-gray-600 dark:border-gray-500 dark:text-gray-300" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Date of Birth</label>
                        <input type="date" name="dob" value={formData.dob || ''} onChange={handleInputChange} required className="mt-1 w-full p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Gender</label>
                        <select name="gender" value={formData.gender || ''} onChange={handleInputChange} required className="mt-1 w-full p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                            <option value="">Select Gender</option>
                            <option value="Male">Male</option>
                            <option value="Female">Female</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-gray-700 dark:text-gray-200 mb-3">Identity Proof</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">ID Type</label>
                        <select name="idType" value={formData.idType || ''} onChange={handleInputChange} required className="mt-1 w-full p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                            <option value="">Select ID Type</option>
                            <option value="Aadhaar">Aadhaar Card</option>
                            <option value="PAN">PAN Card</option>
                            <option value="Voter ID">Voter ID</option>
                            <option value="Passport">Passport</option>
                            <option value="Driving License">Driving License</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">ID Number</label>
                        <input type="text" name="idNumber" value={formData.idNumber || ''} onChange={handleInputChange} required className="mt-1 w-full p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="e.g. ABCD1234E" />
                    </div>
                </div>
                
                {platformSettings.isKycIdProofRequired && (
                    <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase mb-2">Upload Document Image</label>
                        {!idProofPreview ? (
                            <div 
                                onClick={() => idProofRef.current?.click()}
                                className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-700/50 transition-colors"
                            >
                                <ImageIcon className="w-8 h-8 text-gray-400 mb-2" />
                                <p className="text-sm text-gray-500 dark:text-gray-400 font-medium">Click to upload ID Proof</p>
                                <p className="text-xs text-gray-400 mt-1">JPG, PNG or PDF (Max 5MB)</p>
                                <input type="file" ref={idProofRef} onChange={handleFileChange} accept="image/png, image/jpeg, application/pdf" className="hidden"/>
                            </div>
                        ) : (
                            <div className="relative w-full h-48 bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden border border-gray-300 dark:border-gray-600 group">
                                <img src={idProofPreview} alt="ID Preview" className="w-full h-full object-contain" />
                                <div className="absolute inset-0 bg-black bg-opacity-40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                    <button type="button" onClick={removeIdProof} className="p-2 bg-white rounded-full text-red-600 shadow-lg hover:bg-red-50 transition-colors">
                                        <TrashIcon className="w-5 h-5" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                <h3 className="font-semibold text-gray-700 dark:text-gray-200 mb-3">Address Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Full Address</label>
                        <input type="text" name="address" value={formData.address || ''} onChange={handleInputChange} required className="mt-1 w-full p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="House No, Street" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Village / Town</label>
                        <input type="text" name="villageTown" value={formData.villageTown || ''} onChange={handleInputChange} required className="mt-1 w-full p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Road / Area</label>
                        <input type="text" name="roadNameArea" value={formData.roadNameArea || ''} onChange={handleInputChange} required className="mt-1 w-full p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">City</label>
                        <input type="text" name="city" value={formData.city || ''} onChange={handleInputChange} required className="mt-1 w-full p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">District</label>
                        <input type="text" name="district" value={formData.district || ''} onChange={handleInputChange} required className="mt-1 w-full p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">State</label>
                        <select name="state" value={formData.state || ''} onChange={handleInputChange} required className="mt-1 w-full p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                            <option value="">Select State</option>
                            {indianStates.map(s => <option key={s} value={s}>{s}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">PIN Code</label>
                        <input type="text" name="pincode" value={formData.pincode || ''} onChange={handleInputChange} required className="mt-1 w-full p-2 border border-gray-300 rounded-md focus:ring-indigo-500 focus:border-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                    </div>
                </div>
            </div>
            
            {platformSettings.isKycSelfieRequired && (
                <div className="bg-gray-50 dark:bg-gray-700/30 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                    <h3 className="font-semibold text-gray-700 dark:text-gray-200 mb-3">Liveness Check</h3>
                    <CameraCapture
                        capturedImage={selfieDataUrl}
                        onCapture={setSelfieDataUrl}
                        onRetake={() => setSelfieDataUrl(null)}
                        selfieInstruction="Please position your face in the frame and click capture."
                    />
                </div>
            )}
            
            <div className="h-6 text-center">
                {error && <p className="text-red-500 text-sm font-medium">{error}</p>}
                {success && <p className="text-green-500 text-sm font-medium">{success}</p>}
            </div>

             <div className="flex items-center justify-between pt-4">
                <button type="button" onClick={() => setMode('options')} className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline">Back to options</button>
                <button type="submit" disabled={isLoading || !!success} className="py-3 px-8 font-semibold rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 shadow-md transition-transform active:scale-95">
                    {isLoading ? 'Submitting...' : 'Submit KYC'}
                </button>
             </div>
        </form>
    );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col justify-center items-center p-4">
        <div className="max-w-3xl w-full">
            <div className="flex justify-center mb-8">
                <LogoIcon showTagline className="h-16 w-auto" />
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl p-8 border border-gray-100 dark:border-gray-700">
                 {mode === 'options' && renderOptions()}
                 {mode === 'manual' && renderManualForm()}
            </div>
        </div>
    </div>
  );
};

export default KycPage;
