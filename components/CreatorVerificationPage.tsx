
import React, { useState, useRef } from 'react';
import { User, CreatorVerificationDetails, PlatformSettings } from '../types';
import { apiService } from '../services/apiService';
import { LogoIcon, ImageIcon, CheckBadgeIcon } from './Icons';

interface CreatorVerificationPageProps {
  user: User;
  onVerificationSubmitted: () => void;
  onBack: () => void;
}

const CreatorVerificationPage: React.FC<CreatorVerificationPageProps> = ({ user, onVerificationSubmitted, onBack }) => {
  const [formData, setFormData] = useState<CreatorVerificationDetails>(user.creatorVerificationDetails || {});
  
  // Files
  const [registrationFile, setRegistrationFile] = useState<File | null>(null);
  const [officeFile, setOfficeFile] = useState<File | null>(null);
  const [panFile, setPanFile] = useState<File | null>(null);
  const [stampFile, setStampFile] = useState<File | null>(null); // TV Only
  const [acknowledgementFile, setAcknowledgementFile] = useState<File | null>(null); // Influencer Only

  // Previews
  const [previews, setPreviews] = useState<{ [key: string]: string }>({});

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, key: string, setFile: React.Dispatch<React.SetStateAction<File | null>>) => {
    if (e.target.files?.[0]) {
        const file = e.target.files[0];
        
        // File size validation (5MB limit)
        if (file.size > 5 * 1024 * 1024) {
            alert("File size is too large. Please upload an image smaller than 5MB.");
            return;
        }

        setFile(file);
        setPreviews(prev => ({ ...prev, [key]: URL.createObjectURL(file) }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
        // Validation
        if (user.role === 'banneragency' || user.role === 'livetv') {
            if (!registrationFile && !formData.registrationDocUrl) throw new Error("Registration document is required.");
            if (!officeFile && !formData.officePhotoUrl) throw new Error("Office photo is required.");
            if (!panFile && !formData.businessPanUrl) throw new Error("Business PAN is required.");
        }
        if (user.role === 'livetv') {
            if (!stampFile && !formData.channelStampUrl) throw new Error("Channel stamp with signature is required.");
        }
        if (user.role === 'influencer') {
            if (!formData.socialMediaLinks) throw new Error("Social media links are required.");
        }

        const filesToUpload: any = {
            registration: registrationFile,
            office: officeFile,
            pan: panFile,
            stamp: stampFile,
            acknowledgement: acknowledgementFile
        };

        await apiService.submitCreatorVerification(user.id, formData, filesToUpload);
        setSuccess("Verification details submitted successfully!");
        setTimeout(onVerificationSubmitted, 2000);

    } catch (err: any) {
        console.error("Submit Error:", err);
        setError(err.message || "Failed to submit verification.");
    } finally {
        setIsLoading(false);
    }
  };

  const FileInput: React.FC<{ label: string, fileKey: string, setFile: any, currentUrl?: string }> = ({ label, fileKey, setFile, currentUrl }) => (
      <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4 text-center hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
          <p className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">{label}</p>
          {previews[fileKey] || currentUrl ? (
              <div className="relative inline-block">
                  <img src={previews[fileKey] || currentUrl} alt="Preview" className="h-32 object-contain rounded border" />
                  <p className="text-xs text-green-600 mt-1">File Selected</p>
              </div>
          ) : (
              <label className="cursor-pointer flex flex-col items-center justify-center h-32">
                  <ImageIcon className="w-8 h-8 text-gray-400 mb-2" />
                  <span className="text-xs text-indigo-600">Click to Upload (Max 5MB)</span>
                  <input type="file" className="hidden" onChange={(e) => handleFileChange(e, fileKey, setFile)} accept="image/*,.pdf" />
              </label>
          )}
      </div>
  );

  return (
    <div className="max-w-3xl mx-auto p-6">
        <div className="text-center mb-8">
            <LogoIcon className="h-12 w-auto mx-auto mb-4" />
            <h1 className="text-3xl font-bold text-gray-800 dark:text-white">Get Verified</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-2">Complete your verification to unlock full platform potential and build trust with brands.</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
                
                {(user.role === 'banneragency' || user.role === 'livetv') && (
                    <>
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-white border-b pb-2">Business Details</h3>
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Registration Document Type</label>
                            <select 
                                name="registrationDocType" 
                                value={formData.registrationDocType || 'msme'} 
                                onChange={handleInputChange}
                                className="w-full p-2 border rounded dark:bg-gray-700 dark:text-white"
                            >
                                <option value="msme">MSME Certificate</option>
                                <option value="gst">GST Certificate</option>
                                <option value="trade_license">Trade License</option>
                            </select>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <FileInput label="MSME / GST / Trade License (Photo)" fileKey="registration" setFile={setRegistrationFile} currentUrl={formData.registrationDocUrl} />
                            <FileInput label="Office Photo" fileKey="office" setFile={setOfficeFile} currentUrl={formData.officePhotoUrl} />
                            <FileInput label="Business PAN Card" fileKey="pan" setFile={setPanFile} currentUrl={formData.businessPanUrl} />
                            {user.role === 'livetv' && (
                                <FileInput label="Channel Stamp with Authorized Signature" fileKey="stamp" setFile={setStampFile} currentUrl={formData.channelStampUrl} />
                            )}
                        </div>
                    </>
                )}

                {user.role === 'influencer' && (
                    <>
                        <h3 className="text-lg font-semibold text-gray-800 dark:text-white border-b pb-2">Creator Details</h3>
                        
                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Social Media Links</label>
                            <textarea 
                                name="socialMediaLinks" 
                                value={formData.socialMediaLinks || ''} 
                                onChange={handleInputChange}
                                rows={4}
                                placeholder="YouTube: https://youtube.com/...\nInstagram: https://instagram.com/..."
                                className="w-full p-2 border rounded dark:bg-gray-700 dark:text-white"
                                required
                            />
                            <p className="text-xs text-gray-500 mt-1">Please provide links to all your major profiles.</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Creator Proof (Optional)</label>
                            <FileInput label="Acknowledgement Application (Photo) - You are a creator" fileKey="acknowledgement" setFile={setAcknowledgementFile} currentUrl={formData.acknowledgementUrl} />
                            <p className="text-xs text-gray-500 mt-1">Upload a screenshot of your dashboard analytics or any document proving ownership.</p>
                        </div>
                    </>
                )}

                {error && <div className="p-3 bg-red-100 text-red-700 rounded-lg text-sm text-center">{error}</div>}
                {success && <div className="p-3 bg-green-100 text-green-700 rounded-lg text-sm text-center">{success}</div>}

                <div className="flex flex-col gap-3 pt-4">
                    <button type="submit" disabled={isLoading} className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg shadow-md disabled:opacity-50">
                        {isLoading ? 'Submitting...' : 'Submit for Verification'}
                    </button>
                    <button type="button" onClick={onBack} className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 text-center">
                        Cancel and Go Back
                    </button>
                </div>
            </form>
        </div>
    </div>
  );
};

export default CreatorVerificationPage;
