
import React, { useState, useMemo } from 'react';
import { User, AnyCollaboration, RefundRequest, PlatformSettings } from '../types';
import { apiService } from '../services/apiService';
import { ProfileIcon, DocumentTextIcon, ExclamationTriangleIcon, ImageIcon, UploadIcon, CameraIcon, CheckBadgeIcon } from './Icons';
import CameraCapture from './CameraCapture';
import { Timestamp } from 'firebase/firestore';

interface RefundRequestPageProps {
    user: User;
    collaboration: AnyCollaboration;
    onClose: () => void;
    onSubmitted: () => void;
    platformSettings: PlatformSettings;
}

const RefundRequestPage: React.FC<RefundRequestPageProps> = ({ user, collaboration, onClose, onSubmitted, platformSettings }) => {
    // Form State
    const [issueType, setIssueType] = useState('Service Not Delivered');
    const [remarks, setRemarks] = useState('');
    
    // Evidence State
    const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
    const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
    const [proofFile, setProofFile] = useState<File | null>(null);
    const [proofPreview, setProofPreview] = useState<string | null>(null);
    
    // Verification State
    const [selfieDataUrl, setSelfieDataUrl] = useState<string | null>(null);
    
    // Status State
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const getCollaborationType = (): RefundRequest['collabType'] => {
        if ('campaignTitle' in collaboration) return 'campaign';
        if ('influencerId' in collaboration) return 'direct';
        if ('liveTvId' in collaboration) return 'ad_slot';
        if ('agencyId' in collaboration) return 'banner_booking';
        throw new Error('Could not determine collaboration type');
    };

    const collaborationTitle = useMemo(() => {
        if ('title' in collaboration) return collaboration.title;
        if ('campaignTitle' in collaboration) return collaboration.campaignTitle;
        if ('campaignName' in collaboration) return collaboration.campaignName;
        return 'Untitled Collaboration';
    }, [collaboration]);
    
    const finalAmountRaw = collaboration?.finalAmount ? parseFloat(String(collaboration.finalAmount).replace(/[^0-9.-]+/g, "")) : 0;
    const finalAmount = isNaN(finalAmountRaw) ? 0 : finalAmountRaw;

    // Helper for formatted date
    const formattedDate = useMemo(() => {
        const ts = collaboration.timestamp;
        let dateObj: Date | undefined;
        if (ts instanceof Date) dateObj = ts;
        else if (ts && typeof (ts as Timestamp).toDate === 'function') dateObj = (ts as Timestamp).toDate();
        else if (ts && typeof (ts as any).toMillis === 'function') dateObj = new Date((ts as any).toMillis());
        else if (typeof ts === 'string' || typeof ts === 'number') dateObj = new Date(ts);
        
        return dateObj ? dateObj.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'N/A';
    }, [collaboration.timestamp]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'screenshot' | 'proof') => {
        if (e.target.files?.[0]) {
            const file = e.target.files[0];
            if (file.size > 5 * 1024 * 1024) {
                alert("File size too large. Max 5MB.");
                return;
            }
            if (type === 'screenshot') {
                setScreenshotFile(file);
                setScreenshotPreview(URL.createObjectURL(file));
            } else {
                setProofFile(file);
                setProofPreview(URL.createObjectURL(file));
            }
        }
    };

    const dataURLtoFile = (dataurl: string, filename: string): File => {
        const arr = dataurl.split(',');
        const mimeMatch = arr[0].match(/:(.*?);/);
        if (!mimeMatch) throw new Error("Invalid Data URL");
        const mime = mimeMatch[1];
        const bstr = atob(arr[1]);
        let n = bstr.length;
        const u8arr = new Uint8Array(n);
        while(n--) {
            u8arr[n] = bstr.charCodeAt(n);
        }
        return new File([u8arr], filename, {type:mime});
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (!remarks.trim()) {
            setError("Please provide remarks describing the issue.");
            return;
        }

        if (!screenshotFile) {
            setError("Please upload a screenshot of the issue/transaction.");
            return;
        }

        if (!selfieDataUrl) {
            setError("A live selfie is required for verification.");
            return;
        }

        setIsLoading(true);
        try {
            // 1. Upload Verification Selfie
            const selfieFile = dataURLtoFile(selfieDataUrl, `refund_selfie_${user.id}_${Date.now()}.jpg`);
            const selfieUrl = await apiService.uploadPayoutSelfie(user.id, selfieFile);

            // 2. Upload Evidence
            let evidenceDescription = `\n\n[EVIDENCE]`;
            
            if (screenshotFile) {
                const url = await apiService.uploadPayoutSelfie(user.id, screenshotFile); // Reusing upload logic for evidence
                evidenceDescription += `\nScreenshot: ${url}`;
            }
            if (proofFile) {
                const url = await apiService.uploadPayoutSelfie(user.id, proofFile);
                evidenceDescription += `\nPayment Proof: ${url}`;
            }

            // 3. Construct Payload
            const fullDescription = `Issue Type: ${issueType}\n\nRemarks: ${remarks}${evidenceDescription}`;

            // Pass "N/A" for deprecated fields kept for schema compatibility
            await apiService.createRefundRequest({
                collaborationId: collaboration.id,
                collabType: getCollaborationType(),
                collabTitle: collaborationTitle,
                brandId: user.id,
                brandName: user.companyName || user.name,
                brandAvatar: user.avatar || '',
                amount: finalAmount,
                bankDetails: "See User Profile / Refund to Source", 
                upiId: "See User Profile", 
                panNumber: "N/A", 
                description: fullDescription,
                collabId: collaboration.collabId || null,
                idProofSelfieUrl: selfieUrl,
            });
            
            onSubmitted();
        } catch (err: any) {
            console.error(err);
            setError(err.message || "Failed to submit refund request.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-[70] p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-3xl h-[90vh] flex flex-col overflow-hidden">
                
                {/* Header */}
                <div className="px-6 py-4 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900">
                    <h2 className="text-xl font-bold text-gray-800 dark:text-white flex items-center gap-2">
                        <ExclamationTriangleIcon className="w-6 h-6 text-red-500" />
                        Refund Request Form
                    </h2>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-2xl leading-none">&times;</button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8">
                    
                    {/* User Info - Prefilled */}
                    <section className="space-y-3">
                        <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
                            <ProfileIcon className="w-4 h-4" /> User Info
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 dark:bg-gray-700/30 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Full Name</label>
                                <div className="font-medium text-gray-800 dark:text-gray-200">{user.name}</div>
                            </div>
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Mobile Number</label>
                                <div className="font-medium text-gray-800 dark:text-gray-200">{user.mobileNumber || 'N/A'}</div>
                            </div>
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">User ID</label>
                                <div className="font-medium text-gray-800 dark:text-gray-200 font-mono">{user.piNumber || user.id}</div>
                            </div>
                        </div>
                    </section>

                    {/* Transaction Info - Prefilled */}
                    <section className="space-y-3">
                        <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
                            <DocumentTextIcon className="w-4 h-4" /> Transaction Info
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-gray-50 dark:bg-gray-700/30 p-4 rounded-xl border border-gray-100 dark:border-gray-700">
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Transaction ID / Collab ID</label>
                                <div className="font-mono font-medium text-gray-800 dark:text-gray-200 select-all">
                                    {collaboration.collabId || collaboration.id}
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Service Type</label>
                                <div className="font-medium text-gray-800 dark:text-gray-200 capitalize">
                                    {getCollaborationType().replace('_', ' ')}
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Date & Time of Transaction</label>
                                <div className="font-medium text-gray-800 dark:text-gray-200">{formattedDate}</div>
                            </div>
                            <div>
                                <label className="block text-xs text-gray-400 mb-1">Consumer ID / Account</label>
                                <div className="font-medium text-gray-800 dark:text-gray-200">{user.piNumber}</div>
                            </div>
                        </div>
                    </section>

                    <form id="refundForm" onSubmit={handleSubmit} className="space-y-8">
                        {/* Issue & Amount */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <section className="space-y-3">
                                <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Issue Type</h3>
                                <select 
                                    value={issueType} 
                                    onChange={e => setIssueType(e.target.value)} 
                                    className="w-full p-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:text-white"
                                >
                                    <option value="Service Not Delivered">Service Not Delivered</option>
                                    <option value="Quality Issue">Quality Issue / Not as described</option>
                                    <option value="Duplicate Payment">Duplicate Payment</option>
                                    <option value="Wrong Amount">Wrong Amount Charged</option>
                                    <option value="Other">Other</option>
                                </select>
                            </section>

                            <section className="space-y-3">
                                <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Amount</h3>
                                <div className="flex gap-4">
                                    <div className="flex-1">
                                        <label className="block text-xs text-gray-400 mb-1">Transaction Amount</label>
                                        <div className="w-full p-3 bg-gray-100 dark:bg-gray-700 rounded-lg text-gray-600 dark:text-gray-300 font-bold">
                                            ₹{finalAmount.toLocaleString()}
                                        </div>
                                    </div>
                                    <div className="flex-1">
                                        <label className="block text-xs text-gray-400 mb-1">Refund Amount</label>
                                        <div className="w-full p-3 bg-indigo-50 dark:bg-indigo-900/30 border border-indigo-200 dark:border-indigo-800 rounded-lg text-indigo-700 dark:text-indigo-300 font-bold">
                                            ₹{finalAmount.toLocaleString()}
                                        </div>
                                    </div>
                                </div>
                            </section>
                        </div>

                        {/* Evidence Upload */}
                        <section className="space-y-3">
                            <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                <UploadIcon className="w-4 h-4" /> Evidence Upload
                            </h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                {/* Screenshot Upload */}
                                <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-4 text-center hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors relative">
                                    {screenshotPreview ? (
                                        <div className="relative h-32 w-full flex items-center justify-center">
                                            <img src={screenshotPreview} alt="Screenshot" className="max-h-full max-w-full rounded shadow-sm object-contain" />
                                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity rounded">
                                                <p className="text-white text-xs font-bold">Change</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="h-32 flex flex-col items-center justify-center text-gray-400">
                                            <ImageIcon className="w-8 h-8 mb-2" />
                                            <p className="text-sm">Screenshot of Issue <span className="text-red-500">*</span></p>
                                            <p className="text-xs mt-1">Click to upload</p>
                                        </div>
                                    )}
                                    <input 
                                        type="file" 
                                        accept="image/*" 
                                        onChange={e => handleFileChange(e, 'screenshot')} 
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                                        required 
                                    />
                                </div>

                                {/* Payment Proof Upload */}
                                <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-4 text-center hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors relative">
                                    {proofPreview ? (
                                        <div className="relative h-32 w-full flex items-center justify-center">
                                            <img src={proofPreview} alt="Proof" className="max-h-full max-w-full rounded shadow-sm object-contain" />
                                            <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity rounded">
                                                <p className="text-white text-xs font-bold">Change</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="h-32 flex flex-col items-center justify-center text-gray-400">
                                            <DocumentTextIcon className="w-8 h-8 mb-2" />
                                            <p className="text-sm">Payment Proof (Optional)</p>
                                            <p className="text-xs mt-1">Click to upload</p>
                                        </div>
                                    )}
                                    <input 
                                        type="file" 
                                        accept="image/*,.pdf" 
                                        onChange={e => handleFileChange(e, 'proof')} 
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" 
                                    />
                                </div>
                            </div>
                        </section>

                        {/* Remarks */}
                        <section className="space-y-3">
                            <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Remarks</h3>
                            <textarea 
                                value={remarks}
                                onChange={e => setRemarks(e.target.value)}
                                placeholder="Describe the issue in detail..."
                                rows={4}
                                className="w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 dark:bg-gray-800 dark:border-gray-600 dark:text-white resize-none"
                                required
                            />
                        </section>

                        {/* Live Selfie Verification */}
                        <section className="space-y-3">
                            <div className="flex justify-between items-center">
                                <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase tracking-wider flex items-center gap-2">
                                    <CameraIcon className="w-4 h-4" /> Verification
                                </h3>
                                {selfieDataUrl && <span className="text-green-600 text-xs font-bold flex items-center gap-1"><CheckBadgeIcon className="w-4 h-4" /> Captured</span>}
                            </div>
                            <div className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl border border-gray-200 dark:border-gray-700">
                                <CameraCapture
                                    capturedImage={selfieDataUrl}
                                    onCapture={setSelfieDataUrl}
                                    onRetake={() => setSelfieDataUrl(null)}
                                    selfieInstruction="Take a live selfie to verify your identity for this refund request."
                                />
                            </div>
                        </section>

                        {error && (
                            <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-red-600 text-center text-sm font-medium">
                                {error}
                            </div>
                        )}
                    </form>
                </div>

                {/* Footer Actions */}
                <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-end gap-4">
                    <button 
                        type="button"
                        onClick={onClose}
                        className="px-6 py-3 text-sm font-semibold text-gray-600 bg-white border border-gray-300 rounded-xl hover:bg-gray-50 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-700"
                    >
                        Cancel
                    </button>
                    <button 
                        type="submit"
                        form="refundForm"
                        disabled={isLoading}
                        className="px-8 py-3 text-sm font-bold text-white bg-gradient-to-r from-red-600 to-pink-600 rounded-xl shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-95 transition-all"
                    >
                        {isLoading ? 'Submitting Request...' : 'Submit Refund Request'}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default RefundRequestPage;
