
import React, { useState, useEffect } from 'react';
import { BACKEND_URL } from '../services/firebase';

const MockDigiLockerPage: React.FC = () => {
    const [userId, setUserId] = useState<string | null>(null);
    const [status, setStatus] = useState<'idle' | 'processing' | 'success' | 'error'>('idle');
    const [message, setMessage] = useState('');

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const uid = params.get('userId');
        if (uid) {
            setUserId(uid);
        } else {
            setStatus('error');
            setMessage('Invalid Request: No User ID provided.');
        }
    }, []);

    const handleVerification = async (resultStatus: 'approved' | 'rejected') => {
        if (!userId) return;
        setStatus('processing');
        
        try {
            const response = await fetch(`${BACKEND_URL}/mock-kyc-verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId,
                    status: resultStatus,
                    details: resultStatus === 'approved' ? {
                        verifiedBy: 'Mock DigiLocker API',
                        verificationDate: new Date().toISOString(),
                        idType: 'Aadhaar',
                        idNumber: 'XXXX-XXXX-' + Math.floor(1000 + Math.random() * 9000),
                        name: 'Test User',
                        dob: '1995-05-15',
                        gender: 'Female',
                        address: 'Block B, Cyber Hub, Gurugram',
                        state: 'Haryana',
                        pincode: '122002'
                    } : null
                })
            });

            const data = await response.json();
            if (response.ok) {
                setStatus('success');
                setMessage(resultStatus === 'approved' ? 'Verification Successful! You can close this window.' : 'Verification Rejected.');
                
                // Auto-close after 2 seconds for better UX
                if (resultStatus === 'approved') {
                    setTimeout(() => window.close(), 2000);
                }
            } else {
                throw new Error(data.message || 'Verification failed');
            }
        } catch (err: any) {
            setStatus('error');
            setMessage(err.message || 'Connection failed');
        }
    };

    if (status === 'success') {
        return (
            <div className="min-h-screen bg-green-50 flex items-center justify-center p-6">
                <div className="text-center">
                    <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-4xl">✅</span>
                    </div>
                    <h1 className="text-2xl font-bold text-green-800">Verified!</h1>
                    <p className="text-green-700 mt-2">{message}</p>
                    <button onClick={() => window.close()} className="mt-6 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">Close Window</button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-blue-50 flex flex-col items-center justify-center p-6 font-sans">
            <div className="bg-white p-8 rounded-xl shadow-2xl max-w-md w-full text-center border-t-8 border-blue-600">
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-blue-800">DigiLocker <span className="text-xs bg-gray-200 text-gray-600 px-2 py-1 rounded uppercase">Mock</span></h1>
                    <p className="text-gray-500 mt-2">Government of India (Simulation)</p>
                </div>

                <div className="bg-blue-50 p-4 rounded-lg mb-6 text-left text-sm text-blue-800">
                    <p><strong>Requesting App:</strong> BIGYAPON</p>
                    <p><strong>User ID:</strong> {userId || 'Unknown'}</p>
                    <p className="mt-2">This application is requesting access to your verified identity documents (Aadhaar/PAN).</p>
                </div>

                {status === 'error' && (
                    <div className="bg-red-50 text-red-700 p-3 rounded-lg mb-4 text-sm">{message}</div>
                )}

                {status === 'processing' ? (
                    <div className="py-8">
                        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
                        <p className="mt-4 text-gray-600">Processing verification...</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <button 
                            onClick={() => handleVerification('approved')}
                            disabled={!userId}
                            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow transition-transform active:scale-95"
                        >
                            Allow & Verify (Simulate Success)
                        </button>
                        <button 
                            onClick={() => handleVerification('rejected')}
                            disabled={!userId}
                            className="w-full py-3 px-4 bg-gray-200 hover:bg-gray-300 text-gray-700 font-semibold rounded-lg transition-colors"
                        >
                            Deny (Simulate Rejection)
                        </button>
                    </div>
                )}
                
                <div className="mt-8 pt-4 border-t text-xs text-gray-400">
                    This is a simulated environment for testing purposes only. No real data is accessed.
                </div>
            </div>
        </div>
    );
};

export default MockDigiLockerPage;
