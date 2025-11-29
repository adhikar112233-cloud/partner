
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { User, AdSlotRequest, BannerAdBookingRequest, PlatformSettings } from '../types';
import { apiService } from '../services/apiService';
import { BanknotesIcon, CreditCardIcon, PencilIcon } from './Icons';

interface DailyPayoutRequestModalProps {
    user: User;
    onClose: () => void;
    platformSettings: PlatformSettings;
}

type ActiveCollab = AdSlotRequest | BannerAdBookingRequest;

const DailyPayoutRequestModal: React.FC<DailyPayoutRequestModalProps> = ({ user, onClose, platformSettings }) => {
    const [activeCollabs, setActiveCollabs] = useState<ActiveCollab[]>([]);
    const [selectedCollabIds, setSelectedCollabIds] = useState<Set<string>>(new Set());
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [step, setStep] = useState(1); // 1: form, 2: record, 3: success

    const [isRecording, setIsRecording] = useState(false);
    const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const recordedChunksRef = useRef<Blob[]>([]);

    // Payment Details Edit State
    const [isEditingDetails, setIsEditingDetails] = useState(false);
    const [editBankDetails, setEditBankDetails] = useState({
        accountHolderName: user.savedBankDetails?.accountHolderName || '',
        accountNumber: user.savedBankDetails?.accountNumber || '',
        ifscCode: user.savedBankDetails?.ifscCode || '',
        bankName: user.savedBankDetails?.bankName || '',
    });
    const [editUpiId, setEditUpiId] = useState(user.savedUpiId || '');
    
    // Local display state to reflect changes immediately
    const [currentBankDetails, setCurrentBankDetails] = useState(user.savedBankDetails);
    const [currentUpiId, setCurrentUpiId] = useState(user.savedUpiId);

    useEffect(() => {
        const fetchActiveCollabs = async () => {
            if (user.role !== 'livetv' && user.role !== 'banneragency') return;
            setIsLoading(true);
            try {
                const data = await apiService.getActiveAdCollabsForAgency(user.id, user.role);
                // Cast to ActiveCollab[]
                setActiveCollabs(data as ActiveCollab[]);
            } catch (err) {
                setError("Failed to fetch active collaborations.");
            } finally {
                setIsLoading(false);
            }
        };
        fetchActiveCollabs();
    }, [user.id, user.role]);

    // Helper to calculate daily rate
    const getDailyRate = (collab: ActiveCollab) => {
        const amount = parseFloat(String(collab.finalAmount).replace(/[^0-9.-]+/g, "")) || 0;
        const start = new Date(collab.startDate);
        const end = new Date(collab.endDate);
        const diffTime = Math.abs(end.getTime() - start.getTime());
        const durationDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1; 
        return amount / durationDays;
    };

    // Financial Calculations
    const financials = useMemo(() => {
        let totalEarnings = 0;
        selectedCollabIds.forEach(id => {
            const collab = activeCollabs.find(c => c.id === id);
            if (collab) {
                totalEarnings += getDailyRate(collab);
            }
        });

        // Fee Logic: Using platform commission rate as the payout fee base
        const commissionRate = platformSettings.platformCommissionRate || 10; 
        const payoutFee = totalEarnings * (commissionRate / 100);
        
        // GST: 18% on the Fee
        const gstRate = 18;
        const gst = payoutFee * (gstRate / 100);

        const finalAmount = totalEarnings - payoutFee - gst;

        return {
            totalEarnings,
            payoutFee,
            gst,
            finalAmount: Math.max(0, finalAmount)
        };
    }, [selectedCollabIds, activeCollabs, platformSettings]);

    const toggleSelection = (id: string) => {
        const newSet = new Set(selectedCollabIds);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedCollabIds(newSet);
    };

    const stopCamera = () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
            videoRef.current.srcObject = null;
        }
    };
    
    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            if (videoRef.current) videoRef.current.srcObject = stream;
            
            mediaRecorderRef.current = new MediaRecorder(stream);
            recordedChunksRef.current = [];
            
            mediaRecorderRef.current.ondataavailable = (event) => {
                if (event.data.size > 0) recordedChunksRef.current.push(event.data);
            };
            
            mediaRecorderRef.current.onstop = () => {
                const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
                setVideoBlob(blob);
                stopCamera();
            };
            
            mediaRecorderRef.current.start();
            setIsRecording(true);
        } catch (err: any) {
            console.error("Error accessing media devices:", err);
            let errorMessage = "Could not access camera/microphone. Please ensure your browser supports it and you have granted permission.";
            if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
                errorMessage = "No camera and/or microphone found. Please connect your devices and try again.";
            } else if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
                errorMessage = "Camera and/or microphone access was denied. Please allow access in your browser settings.";
            } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
                errorMessage = "Your camera or microphone is currently in use by another application or there was a hardware error.";
            }
            setError(errorMessage);
        }
    };

    const stopRecording = () => {
        if (mediaRecorderRef.current) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    };

    const handleSavePaymentDetails = async () => {
        setError(null);
        // Basic Validation
        if (!editUpiId && (!editBankDetails.accountNumber || !editBankDetails.ifscCode)) {
            setError("Please provide either Bank Details or UPI ID.");
            return;
        }
        
        setIsLoading(true);
        try {
            const updatedBank = { ...editBankDetails, isVerified: false };
            await apiService.updateUserProfile(user.id, {
                savedBankDetails: updatedBank, 
                savedUpiId: editUpiId,
                isUpiVerified: false
            });
            setCurrentBankDetails(updatedBank);
            setCurrentUpiId(editUpiId);
            setIsEditingDetails(false);
        } catch (e) {
            setError("Failed to save payment details.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (videoBlobToUpload: Blob | null = videoBlob) => {
        if (selectedCollabIds.size === 0) return;
        if (platformSettings.payoutSettings.requireLiveVideoForDailyPayout && !videoBlobToUpload) {
            setError("A verification video is required for this request.");
            return;
        }

        setIsLoading(true);
        setError(null);
        try {
            let videoUrl: string | undefined = undefined;
            if (videoBlobToUpload) {
                videoUrl = await apiService.uploadDailyPayoutVideo(user.id, videoBlobToUpload);
            }
            
            const promises = Array.from(selectedCollabIds).map(async (collabId) => {
                const collab = activeCollabs.find(c => c.id === collabId);
                if (!collab) return;

                const dailyRate = getDailyRate(collab);
                
                // Let's store the calculated partials
                const ratio = dailyRate / financials.totalEarnings;
                const reqFee = financials.payoutFee * ratio;
                const reqGst = financials.gst * ratio;
                const reqFinal = dailyRate - reqFee - reqGst;

                const requestData: any = {
                    userId: user.id,
                    userName: user.name,
                    userRole: user.role,
                    collaborationId: collabId,
                    collabId: collab.collabId || null,
                    collaborationType: user.role === 'livetv' ? 'ad_slot' : 'banner_booking',
                    approvedAmount: reqFinal, // Storing the calculated net amount
                };

                if (videoUrl) {
                    requestData.videoUrl = videoUrl;
                }

                return apiService.submitDailyPayoutRequest(requestData);
            });

            await Promise.all(promises);
            setStep(3); // Success
            setTimeout(onClose, 3000);
        } catch (err) {
            console.error(err);
            setError("Failed to submit request.");
        } finally {
            setIsLoading(false);
        }
    };
    
    const script = `Hi BIGYAPON, I am ${user.name}, checking out for today. I confirm my channels/ads are active.`;

    const handleNextStep = () => {
        if (selectedCollabIds.size === 0) {
            setError("Please select at least one campaign.");
            return;
        }
        
        // Check local state for details (user might have just updated them)
        const hasBankDetails = currentBankDetails && currentBankDetails.accountNumber;
        const hasUpi = !!currentUpiId;

        if (!hasBankDetails && !hasUpi) {
            setError("Please add Bank or UPI details below before proceeding.");
            return;
        }

        if (platformSettings.payoutSettings.requireLiveVideoForDailyPayout) {
            setStep(2);
        } else {
            handleSubmit(null);
        }
    };

    if (isLoading && step !== 1 && !isEditingDetails) {
        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-[80] p-4">
                <div className="bg-white p-8 rounded-lg text-center">
                    <div className="w-12 h-12 border-4 border-dashed rounded-full animate-spin border-indigo-500 mx-auto"></div>
                    <p className="mt-4">Processing request...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-[70] p-4 backdrop-blur-sm">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-2xl relative flex flex-col max-h-[90vh]">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 z-10 text-2xl leading-none">&times;</button>
                
                {step === 1 && (
                    <div className="p-6 sm:p-8 overflow-y-auto">
                        <div className="text-center mb-6">
                            <h2 className="text-2xl font-bold text-gray-800 dark:text-white uppercase tracking-wide">Daily Payout Request Form</h2>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Select active ads to claim today's earnings.</p>
                        </div>

                        {isLoading && !isEditingDetails ? (
                            <div className="text-center py-10 text-gray-500">Loading active campaigns...</div>
                        ) : activeCollabs.length === 0 ? (
                            <div className="text-center py-10 text-gray-500">
                                <p>You have no active collaborations eligible for daily payout.</p>
                            </div>
                        ) : (
                            <div className="space-y-6">
                                {/* SELECTION SECTION */}
                                <section>
                                    <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase mb-3 border-b dark:border-gray-700 pb-1">
                                        Select Ads for Daily Payout
                                    </h3>
                                    <div className="space-y-2">
                                        {activeCollabs.map(collab => {
                                            const dailyRate = getDailyRate(collab);
                                            const isSelected = selectedCollabIds.has(collab.id);
                                            return (
                                                <label 
                                                    key={collab.id} 
                                                    className={`flex items-center p-3 rounded-lg border cursor-pointer transition-colors ${isSelected ? 'bg-indigo-50 border-indigo-500 dark:bg-indigo-900/20 dark:border-indigo-500' : 'bg-white border-gray-200 dark:bg-gray-700 dark:border-gray-600'}`}
                                                >
                                                    <input 
                                                        type="checkbox" 
                                                        checked={isSelected}
                                                        onChange={() => toggleSelection(collab.id)}
                                                        className="h-5 w-5 text-indigo-600 focus:ring-indigo-500 border-gray-300 rounded"
                                                    />
                                                    <div className="ml-3 flex-1">
                                                        <span className="block font-medium text-gray-900 dark:text-white">
                                                            {collab.campaignName} <span className="text-xs text-gray-500 font-normal">#{collab.collabId || collab.id.slice(0, 6)}</span>
                                                        </span>
                                                        <span className="text-sm text-gray-500 dark:text-gray-400">
                                                            {user.role === 'livetv' ? 'LIVE TV' : 'BANNER ADS'} — ₹{dailyRate.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 0})}/day
                                                        </span>
                                                    </div>
                                                </label>
                                            );
                                        })}
                                    </div>
                                </section>

                                {/* CALCULATION SECTION */}
                                <section className="bg-gray-50 dark:bg-gray-700/50 p-4 rounded-xl border border-gray-200 dark:border-gray-600">
                                    <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase mb-3 border-b border-gray-200 dark:border-gray-600 pb-1">
                                        Calculated Fields
                                    </h3>
                                    <div className="space-y-2 text-sm">
                                        <div className="flex justify-between">
                                            <span className="text-gray-600 dark:text-gray-300">Total Daily Earnings:</span>
                                            <span className="font-semibold text-gray-900 dark:text-white">₹ {financials.totalEarnings.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-600 dark:text-gray-300">Daily Payout Fee ({platformSettings.platformCommissionRate}%):</span>
                                            <span className="text-red-600 dark:text-red-400">- ₹ {financials.payoutFee.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                        </div>
                                        <div className="flex justify-between">
                                            <span className="text-gray-600 dark:text-gray-300">GST (18% on Fee):</span>
                                            <span className="text-red-600 dark:text-red-400">- ₹ {financials.gst.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                        </div>
                                        <div className="flex justify-between pt-2 border-t border-gray-200 dark:border-gray-600 mt-2">
                                            <span className="font-bold text-gray-800 dark:text-white">Final Payout Amount:</span>
                                            <span className="font-bold text-green-600 dark:text-green-400 text-lg">₹ {financials.finalAmount.toLocaleString(undefined, {minimumFractionDigits: 2})}</span>
                                        </div>
                                    </div>
                                </section>

                                {/* BENEFICIARY SECTION */}
                                <section>
                                    <div className="flex justify-between items-center mb-3 border-b dark:border-gray-700 pb-1">
                                        <h3 className="text-sm font-bold text-gray-500 dark:text-gray-400 uppercase">
                                            Bank Account Details
                                        </h3>
                                        <button 
                                            onClick={() => setIsEditingDetails(!isEditingDetails)} 
                                            className="text-indigo-600 hover:text-indigo-800 text-xs font-semibold flex items-center gap-1"
                                        >
                                            <PencilIcon className="w-3 h-3" />
                                            {isEditingDetails ? 'Cancel Edit' : 'Add/Edit Details'}
                                        </button>
                                    </div>

                                    {isEditingDetails ? (
                                        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg border border-indigo-200 dark:border-indigo-700 space-y-4">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                                <input type="text" placeholder="Account Holder Name" value={editBankDetails.accountHolderName} onChange={e => setEditBankDetails({...editBankDetails, accountHolderName: e.target.value})} className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm" />
                                                <input type="text" placeholder="Bank Name" value={editBankDetails.bankName} onChange={e => setEditBankDetails({...editBankDetails, bankName: e.target.value})} className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm" />
                                                <input type="text" placeholder="Account Number" value={editBankDetails.accountNumber} onChange={e => setEditBankDetails({...editBankDetails, accountNumber: e.target.value})} className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm" />
                                                <input type="text" placeholder="IFSC Code" value={editBankDetails.ifscCode} onChange={e => setEditBankDetails({...editBankDetails, ifscCode: e.target.value.toUpperCase()})} className="p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm uppercase" />
                                            </div>
                                            <div className="border-t pt-3 dark:border-gray-600">
                                                <input type="text" placeholder="UPI ID (Optional)" value={editUpiId} onChange={e => setEditUpiId(e.target.value)} className="w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white text-sm" />
                                            </div>
                                            <button 
                                                onClick={handleSavePaymentDetails} 
                                                disabled={isLoading}
                                                className="w-full py-2 bg-indigo-600 text-white rounded font-medium text-sm hover:bg-indigo-700 disabled:opacity-50"
                                            >
                                                {isLoading ? 'Saving...' : 'Save Details'}
                                            </button>
                                        </div>
                                    ) : (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm bg-white dark:bg-gray-800 p-3 rounded-lg border border-gray-200 dark:border-gray-700">
                                            <div>
                                                <label className="block text-xs text-gray-400">Name</label>
                                                <div className="font-medium text-gray-900 dark:text-white truncate">
                                                    {currentBankDetails?.accountHolderName || user.name}
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-xs text-gray-400">Bank Account</label>
                                                <div className="font-medium text-gray-900 dark:text-white font-mono">
                                                    {currentBankDetails?.accountNumber || 'Not provided'}
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-xs text-gray-400">IFSC Code</label>
                                                <div className="font-medium text-gray-900 dark:text-white font-mono">
                                                    {currentBankDetails?.ifscCode || 'Not provided'}
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-xs text-gray-400">UPI ID (Optional)</label>
                                                <div className="font-medium text-gray-900 dark:text-white font-mono">
                                                    {currentUpiId || 'Not provided'}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    {(!currentBankDetails?.accountNumber && !currentUpiId && !isEditingDetails) && (
                                        <p className="text-xs text-red-500 mt-2">* Please add your payment details above to proceed.</p>
                                    )}
                                </section>

                                {error && <p className="text-red-500 text-sm text-center bg-red-50 p-2 rounded">{error}</p>}

                                {!isEditingDetails && (
                                    <button
                                        onClick={handleNextStep}
                                        className="w-full py-3 px-4 border border-transparent rounded-xl shadow-lg text-sm font-bold text-white bg-gradient-to-r from-green-600 to-teal-600 hover:from-green-700 hover:to-teal-700 focus:outline-none transform hover:-translate-y-0.5 transition-all"
                                    >
                                        SUBMIT DAILY PAYOUT REQUEST
                                    </button>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {step === 2 && (
                    <div className="p-6 sm:p-8">
                        <h2 className="text-2xl font-bold text-center mb-4 dark:text-white">Record Proof of Work</h2>
                        <div className="p-4 bg-yellow-50 text-yellow-800 rounded-lg text-sm mb-4 border border-yellow-100">
                            <p className="font-semibold">Please read the following script clearly while recording:</p>
                            <p className="mt-2 italic font-serif">"{script}"</p>
                        </div>
                        
                        {error && <p className="text-red-500 text-sm mb-2">{error}</p>}
                        
                        <div className="bg-black rounded-lg overflow-hidden aspect-video mb-4 shadow-inner">
                            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                        </div>

                        {videoBlob ? (
                            <div className="flex justify-center gap-4">
                                <button onClick={() => { setVideoBlob(null); startRecording(); }} className="py-2 px-4 rounded-lg text-sm font-medium bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600">Retake</button>
                                <button onClick={() => handleSubmit(videoBlob)} className="py-2 px-4 rounded-lg text-sm font-medium text-white bg-green-600 hover:bg-green-700 shadow-md">Submit Proof</button>
                            </div>
                        ) : isRecording ? (
                            <button onClick={stopRecording} className="w-full py-3 px-4 rounded-lg text-sm font-bold text-white bg-red-600 hover:bg-red-700 shadow-md animate-pulse">Stop Recording</button>
                        ) : (
                            <button onClick={startRecording} className="w-full py-3 px-4 rounded-lg text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 shadow-md">Start Recording</button>
                        )}
                        
                        <button onClick={() => setStep(1)} className="mt-4 w-full text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400">Cancel & Go Back</button>
                    </div>
                )}

                {step === 3 && (
                     <div className="p-8 text-center flex flex-col items-center justify-center h-full">
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                            <BanknotesIcon className="w-8 h-8 text-green-600" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-800 dark:text-white mb-2">Request Submitted!</h2>
                        <p className="text-gray-600 dark:text-gray-300">Your daily payout request has been sent to the admin team. You will be notified once it is processed.</p>
                        <button onClick={onClose} className="mt-6 px-6 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300 font-medium transition-colors">Close</button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DailyPayoutRequestModal;
