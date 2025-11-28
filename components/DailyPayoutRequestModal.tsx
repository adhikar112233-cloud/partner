import React, { useState, useEffect, useRef } from 'react';
import { User, AdSlotRequest, BannerAdBookingRequest, PlatformSettings } from '../types';
import { apiService } from '../services/apiService';

interface DailyPayoutRequestModalProps {
    user: User;
    onClose: () => void;
    platformSettings: PlatformSettings;
}

type ActiveCollab = AdSlotRequest | BannerAdBookingRequest;

const DailyPayoutRequestModal: React.FC<DailyPayoutRequestModalProps> = ({ user, onClose, platformSettings }) => {
    const [activeCollabs, setActiveCollabs] = useState<ActiveCollab[]>([]);
    const [selectedCollabId, setSelectedCollabId] = useState('');
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [step, setStep] = useState(1); // 1: select, 2: record, 3: success

    const [isRecording, setIsRecording] = useState(false);
    const [videoBlob, setVideoBlob] = useState<Blob | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const recordedChunksRef = useRef<Blob[]>([]);

    useEffect(() => {
        const fetchActiveCollabs = async () => {
            if (user.role !== 'livetv' && user.role !== 'banneragency') return;
            setIsLoading(true);
            try {
                const data = await apiService.getActiveAdCollabsForAgency(user.id, user.role);
                // FIX: Cast the result from the API to the more specific ActiveCollab[] type expected by the state.
                setActiveCollabs(data as ActiveCollab[]);
                if (data.length > 0) {
                    setSelectedCollabId(data[0].id);
                }
            } catch (err) {
                setError("Failed to fetch active collaborations.");
            } finally {
                setIsLoading(false);
            }
        };
        fetchActiveCollabs();
    }, [user.id, user.role]);

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

    const handleSubmit = async (videoBlobToUpload: Blob | null = videoBlob) => {
        if (!selectedCollabId) return;
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
            
            const collab = activeCollabs.find(c => c.id === selectedCollabId);
            if (!collab) throw new Error("Selected collaboration not found.");

            const requestData: any = {
                userId: user.id,
                userName: user.name,
                userRole: user.role,
                collaborationId: selectedCollabId,
                collabId: collab.collabId || null,
                collaborationType: user.role === 'livetv' ? 'ad_slot' : 'banner_booking',
            };

            if (videoUrl) {
                requestData.videoUrl = videoUrl;
            }

            await apiService.submitDailyPayoutRequest(requestData);
            setStep(3); // Success
            setTimeout(onClose, 3000);
        } catch (err) {
            console.error(err);
            setError("Failed to submit request.");
        } finally {
            setIsLoading(false);
        }
    };
    
    const script = `Hi BIGYAPON, I am ${user.name}, I am showing proof of my active campaign for a daily payout request.`;

    const handleNextStep = () => {
        if (!selectedCollabId) {
            setError("Please select a collaboration.");
            return;
        }
        if (platformSettings.payoutSettings.requireLiveVideoForDailyPayout) {
            setStep(2);
        } else {
            handleSubmit(null);
        }
    };

    if (isLoading && step !== 1) {
        return (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
                <div className="bg-white p-8 rounded-lg text-center">
                    <div className="w-12 h-12 border-4 border-dashed rounded-full animate-spin border-indigo-500 mx-auto"></div>
                    <p className="mt-4">Submitting request...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-2xl relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">&times;</button>
                {step === 1 && (
                    <div>
                        <h2 className="text-2xl font-bold text-center mb-4">Daily Payout Request</h2>
                        {isLoading ? <p>Loading active collaborations...</p> : activeCollabs.length === 0 ? (
                            <p className="text-center text-gray-600">You have no active collaborations eligible for daily payout.</p>
                        ) : (
                            <div className="space-y-4">
                                <div>
                                    <label htmlFor="collab-select" className="block text-sm font-medium text-gray-700">Select Collaboration</label>
                                    <select
                                        id="collab-select"
                                        value={selectedCollabId}
                                        onChange={(e) => setSelectedCollabId(e.target.value)}
                                        className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
                                    >
                                        {activeCollabs.map(collab => (
                                            <option key={collab.id} value={collab.id}>
                                                {collab.campaignName}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                {error && <p className="text-red-500 text-sm">{error}</p>}
                                <button
                                    onClick={handleNextStep}
                                    className="w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                >
                                    {platformSettings.payoutSettings.requireLiveVideoForDailyPayout ? 'Next: Record Proof' : 'Submit Request'}
                                </button>
                            </div>
                        )}
                    </div>
                )}
                {step === 2 && (
                    <div>
                        <h2 className="text-2xl font-bold text-center mb-4">Record Proof of Work</h2>
                        <div className="p-4 bg-yellow-50 text-yellow-800 rounded-lg text-sm mb-4">
                            <p className="font-semibold">Please read the following script clearly while recording:</p>
                            <p className="mt-2 italic">"{script}"</p>
                        </div>
                        
                        {error && <p className="text-red-500 text-sm mb-2">{error}</p>}
                        
                        <div className="bg-black rounded-lg overflow-hidden aspect-video mb-4">
                            <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                        </div>

                        {videoBlob ? (
                            <div className="flex justify-center gap-4">
                                <button onClick={() => { setVideoBlob(null); startRecording(); }} className="py-2 px-4 rounded-md text-sm font-medium bg-gray-200 hover:bg-gray-300">Retake</button>
                                <button onClick={() => handleSubmit(videoBlob)} className="py-2 px-4 rounded-md text-sm font-medium text-white bg-green-600 hover:bg-green-700">Submit</button>
                            </div>
                        ) : isRecording ? (
                            <button onClick={stopRecording} className="w-full py-2 px-4 rounded-md text-sm font-medium text-white bg-red-600 hover:bg-red-700">Stop Recording</button>
                        ) : (
                            <button onClick={startRecording} className="w-full py-2 px-4 rounded-md text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700">Start Recording</button>
                        )}
                    </div>
                )}
                {step === 3 && (
                     <div className="text-center py-8">
                        <h2 className="text-2xl font-bold text-green-500">Request Submitted!</h2>
                        <p className="text-gray-600 mt-2">Your daily payout request is under review. You will be notified of the status shortly.</p>
                    </div>
                )}
            </div>
        </div>
    );
};

export default DailyPayoutRequestModal;