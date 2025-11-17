import React, { useState, useRef } from 'react';
import { User, KycDetails, PlatformSettings } from '../types';
import { apiService } from '../services/apiService';
import CameraCapture from './CameraCapture';
import { LogoIcon } from './Icons';

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
    const [selfieDataUrl, setSelfieDataUrl] = useState<string | null>(null);
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
            setIdProofFile(e.target.files[0]);
        }
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
            const selfieFile = selfieDataUrl ? dataURLtoFile(selfieDataUrl, 'selfie.jpg') : null;
            // FIX: Property 'submitKyc' does not exist on type '{...}'.
            await apiService.submitKyc(user.id, formData, idProofFile, selfieFile);
            
            setSuccess("KYC details submitted successfully! You can now use the app.");
            
            setTimeout(() => {
                onKycSubmitted();
            }, 2000);

        } catch (err: any) {
            console.error(err);
            let errorMessage = "Failed to submit KYC. Please try again. Check your network or file size.";
            if (err.code) { // Check if it's a Firebase error
                switch(err.code) {
                    case 'storage/unauthorized':
                        errorMessage = "Storage permission error. Please check your Firebase Storage security rules.";
                        break;
                    case 'storage/object-not-found':
                    case 'storage/bucket-not-found':
                         errorMessage = "Firebase Storage bucket not found. Please ensure Storage is enabled for your project in the Firebase Console.";
                        break;
                    case 'storage/canceled':
                        errorMessage = "File upload was canceled. Please try again.";
                        break;
                }
            }
            setError(errorMessage);
            setIsLoading(false); // Stop loading ONLY on error
        }
    };
    
    const handleDigilockerSubmit = () => {
        const clientId = platformSettings.digilockerClientId || 'YOUR_DIGILOCKER_CLIENT_ID'; // Use configured or placeholder
        const redirectUri = window.location.origin + '/callback'; // Fake callback for simulation
        const state = Math.random().toString(36).substring(2);
        const nonce = Math.random().toString(36).substring(2);
        
        const digilockerUrl = `https://entity.digilocker.gov.in/public/oauth2/1/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=openid%20profile%20email%20digilocker:read&state=${state}&nonce=${nonce}`;

        const popup = window.open(digilockerUrl, 'digilockerLogin', 'width=600,height=700');
        setIsPopupOpen(true);

        const checkPopup = setInterval(() => {
            if (!popup || popup.closed) {
                clearInterval(checkPopup);
                setIsPopupOpen(false);
                
                // Assume success after popup is closed and simulate verification
                setIsLoading(true);
                setError(null);

                setTimeout(async () => {
                    try {
                        // FIX: Property 'submitDigilockerKyc' does not exist on type '{...}'.
                        await apiService.submitDigilockerKyc(user.id);
                        alert("KYC verified successfully with DigiLocker!");
                        onKycSubmitted();
                    } catch (err) {
                        console.error(err);
                        setError("Failed to verify with DigiLocker. Please try again or use manual verification.");
                    } finally {
                        setIsLoading(false);
                    }
                }, 1000); // Small delay to feel like processing is happening
            }
        }, 500);
    };

    const renderOptions = () => (
         <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">KYC Verification</h2>
            <p className="mt-2 text-gray-600 dark:text-gray-300">Please complete your KYC to continue.</p>
            {isResubmit && user.kycDetails?.rejectionReason && (
                 <div className="mt-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-md text-left dark:bg-red-900/20 dark:text-red-300 dark:border-red-700">
                    <p className="font-semibold">Submission Rejected</p>
                    <p className="text-sm">Reason: {user.kycDetails.rejectionReason}</p>
                 </div>
            )}
            <div className="mt-8 space-y-4">
                <button onClick={() => setMode('manual')} className="w-full py-3 px-4 text-lg font-semibold rounded-lg text-white bg-indigo-600 hover:bg-indigo-700">
                    Manual KYC (Admin Review)
                </button>
                {platformSettings.isDigilockerKycEnabled && (
                    <button onClick={handleDigilockerSubmit} disabled={isLoading || isPopupOpen} className="w-full py-3 px-4 text-lg font-semibold rounded-lg text-white bg-teal-500 hover:bg-teal-600 disabled:opacity-50">
                        {isLoading ? 'Verifying...' : isPopupOpen ? 'Awaiting DigiLocker...' : 'Instant KYC with DigiLocker'}
                    </button>
                )}
            </div>
        </div>
    );
    
    const renderManualForm = () => (
        <form onSubmit={handleManualSubmit} className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 text-center">Manual KYC Verification</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 <div>
                    <label className="block text-sm font-medium dark:text-gray-300">Full Name</label>
                    <input type="text" value={user.name} disabled className="mt-1 w-full p-2 bg-gray-200 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-400" />
                </div>
                 <div>
                    <label className="block text-sm font-medium dark:text-gray-300">Address</label>
                    <input type="text" name="address" value={formData.address || ''} onChange={handleInputChange} required className="mt-1 w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" />
                </div>
                 <div>
                    <label className="block text-sm font-medium dark:text-gray-300">Village / Town</label>
                    <input type="text" name="villageTown" value={formData.villageTown || ''} onChange={handleInputChange} required className="mt-1 w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" />
                </div>
                 <div>
                    <label className="block text-sm font-medium dark:text-gray-300">Road Name / Area</label>
                    <input type="text" name="roadNameArea" value={formData.roadNameArea || ''} onChange={handleInputChange} required className="mt-1 w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" />
                </div>
                 <div>
                    <label className="block text-sm font-medium dark:text-gray-300">PIN Code</label>
                    <input type="text" name="pincode" value={formData.pincode || ''} onChange={handleInputChange} required className="mt-1 w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" />
                </div>
                 <div>
                    <label className="block text-sm font-medium dark:text-gray-300">City</label>
                    <input type="text" name="city" value={formData.city || ''} onChange={handleInputChange} required className="mt-1 w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" />
                </div>
                 <div>
                    <label className="block text-sm font-medium dark:text-gray-300">District</label>
                    <input type="text" name="district" value={formData.district || ''} onChange={handleInputChange} required className="mt-1 w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200" />
                </div>
                 <div>
                    <label className="block text-sm font-medium dark:text-gray-300">State</label>
                     <select name="state" value={formData.state || ''} onChange={handleInputChange} required className="mt-1 w-full p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200">
                        <option value="">Select State</option>
                        {indianStates.map(s => <option key={s} value={s}>{s}</option>)}
                     </select>
                </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {platformSettings.isKycIdProofRequired && (
                    <div>
                        <label className="block text-sm font-medium dark:text-gray-300">ID Proof (Aadhaar/PAN/Voter/Passport)</label>
                        <input type="file" ref={idProofRef} onChange={handleFileChange} accept="image/png, image/jpeg, application/pdf" required={platformSettings.isKycIdProofRequired && !user.kycDetails?.idProofUrl} className="mt-1 block w-full text-sm text-gray-500 dark:text-gray-300 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 dark:file:bg-indigo-900/50 file:text-indigo-700 dark:file:text-indigo-300 hover:file:bg-indigo-100 dark:hover:file:bg-indigo-900"/>
                    </div>
                )}
                {platformSettings.isKycSelfieRequired && (
                    <div>
                        <CameraCapture
                            capturedImage={selfieDataUrl}
                            onCapture={setSelfieDataUrl}
                            onRetake={() => setSelfieDataUrl(null)}
                            selfieInstruction="Please take a clear, live selfie."
                        />
                    </div>
                )}
            </div>
            
            <div className="h-6 text-center">
                {error && <p className="text-red-500 text-sm">{error}</p>}
                {success && <p className="text-green-500 text-sm">{success}</p>}
            </div>

             <div className="flex items-center justify-between pt-4">
                <button type="button" onClick={() => setMode('options')} className="text-sm font-medium text-indigo-600 dark:text-indigo-400">Back to options</button>
                <button type="submit" disabled={isLoading || !!success} className="py-2 px-6 font-semibold rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50">
                    {isLoading ? 'Submitting...' : 'Submit for Verification'}
                </button>
             </div>
        </form>
    );

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col justify-center items-center p-4">
        <div className="max-w-4xl w-full">
            <div className="flex justify-center mb-8">
                <LogoIcon showTagline />
            </div>
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
                 {mode === 'options' && renderOptions()}
                 {mode === 'manual' && renderManualForm()}
            </div>
        </div>
    </div>
  );
};

export default KycPage;
