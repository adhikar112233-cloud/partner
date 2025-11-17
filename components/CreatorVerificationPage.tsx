import React, { useState } from 'react';
import { User, CreatorVerificationDetails } from '../types';
import { apiService } from '../services/apiService';
import { LogoIcon } from './Icons';

interface CreatorVerificationPageProps {
  user: User;
  onVerificationSubmitted: () => void;
  onBack: () => void;
}

const CreatorVerificationPage: React.FC<CreatorVerificationPageProps> = ({ user, onVerificationSubmitted, onBack }) => {
  const [formData, setFormData] = useState<CreatorVerificationDetails>(user.creatorVerificationDetails || {});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setIsLoading(true);

    try {
      await apiService.submitCreatorVerification(user.id, formData);
      setSuccess("Your verification details have been submitted for review. This may take 2-3 business days.");
      setTimeout(() => {
        onVerificationSubmitted();
      }, 3000);
    } catch (err: any) {
      console.error(err);
      setError("Failed to submit details. Please try again.");
      setIsLoading(false);
    }
  };

  const renderInfluencerForm = () => (
    <>
      <div>
        <label htmlFor="socialMediaLinks" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Social Media Links</label>
        <textarea
          id="socialMediaLinks"
          name="socialMediaLinks"
          value={formData.socialMediaLinks || ''}
          onChange={handleInputChange}
          rows={3}
          className="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
          placeholder="e.g., https://instagram.com/yourhandle, https://youtube.com/yourchannel"
          required
        />
      </div>
      <div>
        <label htmlFor="idNumber" className="block text-sm font-medium text-gray-700 dark:text-gray-300">PAN / Aadhaar / Voter ID Number</label>
        <input
          type="text"
          id="idNumber"
          name="idNumber"
          value={formData.idNumber || ''}
          onChange={handleInputChange}
          className="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
          required
        />
      </div>
    </>
  );

  const renderAgencyForm = () => (
    <>
      <div>
        <label htmlFor="registrationNo" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Company Registration No.</label>
        <p className="text-xs text-gray-500 dark:text-gray-400">From any government certificate for your company/agency.</p>
        <input
          type="text"
          id="registrationNo"
          name="registrationNo"
          value={formData.registrationNo || ''}
          onChange={handleInputChange}
          className="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
          required
        />
      </div>
      <div>
        <label htmlFor="msmeNo" className="block text-sm font-medium text-gray-700 dark:text-gray-300">MSME No.</label>
        <input
          type="text"
          id="msmeNo"
          name="msmeNo"
          value={formData.msmeNo || ''}
          onChange={handleInputChange}
          className="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
        />
      </div>
       <div>
        <label htmlFor="businessPan" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Business PAN Card No.</label>
        <input
          type="text"
          id="businessPan"
          name="businessPan"
          value={formData.businessPan || ''}
          onChange={handleInputChange}
          className="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
          required
        />
      </div>
      <div>
        <label htmlFor="tradeLicenseNo" className="block text-sm font-medium text-gray-700 dark:text-gray-300">Trade License No.</label>
        <input
          type="text"
          id="tradeLicenseNo"
          name="tradeLicenseNo"
          value={formData.tradeLicenseNo || ''}
          onChange={handleInputChange}
          className="mt-1 block w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-md shadow-sm dark:bg-gray-700 dark:border-gray-600 dark:text-gray-200"
        />
      </div>
    </>
  );

  return (
    <div className="max-w-4xl mx-auto space-y-6">
       <div className="text-center">
         <h1 className="text-3xl font-bold text-gray-800 dark:text-gray-100">Creator Identity Verification</h1>
         <p className="text-gray-500 dark:text-gray-400 mt-1">Submit your details to get a verified creator badge.</p>
       </div>

      <div className="bg-white dark:bg-gray-800 p-8 rounded-2xl shadow-lg">
        {success ? (
             <div className="text-center py-8">
                <h2 className="text-2xl font-bold text-green-500">Submission Received!</h2>
                <p className="text-gray-600 dark:text-gray-300 mt-2">{success}</p>
            </div>
        ) : (
             <form onSubmit={handleSubmit} className="space-y-6">
            {user.role === 'influencer' ? renderInfluencerForm() : renderAgencyForm()}
            
            <div className="h-6 text-center">
                {error && <p className="text-red-500 text-sm">{error}</p>}
            </div>

            <div className="flex items-center justify-between pt-4 border-t dark:border-gray-700">
                <button type="button" onClick={onBack} className="text-sm font-medium text-indigo-600 dark:text-indigo-400 hover:underline">
                    &larr; Back to Profile
                </button>
                <button type="submit" disabled={isLoading} className="py-2 px-6 font-semibold rounded-lg text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50">
                    {isLoading ? 'Submitting...' : 'Submit for Verification'}
                </button>
            </div>
        </form>
        )}
      </div>
    </div>
  );
};

export default CreatorVerificationPage;
