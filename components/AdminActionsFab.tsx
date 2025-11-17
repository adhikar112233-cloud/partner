import React, { useState } from 'react';
import { User } from '../types';
import { CogIcon, EnvelopeIcon, KeyIcon, LockOpenIcon, LockClosedIcon } from './Icons';

interface AdminActionsFabProps {
    selectedUser: User | null;
    onSendReset: (user: User) => void;
    onToggleBlock: (user: User) => void;
}

const AdminActionsFab: React.FC<AdminActionsFabProps> = ({ selectedUser, onSendReset, onToggleBlock }) => {
    const [isOpen, setIsOpen] = useState(false);

    if (!selectedUser) {
        return null; // Don't render if no user is selected
    }

    const ActionButton: React.FC<{ icon: React.ReactNode; label: string; onClick: () => void; className?: string; disabled?: boolean; tooltip?: string; }> = 
    ({ icon, label, onClick, className = '', disabled = false, tooltip }) => (
        <div className="group relative flex items-center">
             <button
                onClick={onClick}
                disabled={disabled}
                className={`w-full flex items-center text-left p-3 my-1 bg-white rounded-lg shadow-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all ${className}`}
            >
                {icon}
                <span className="ml-3 font-medium text-gray-700">{label}</span>
            </button>
            {tooltip && <div className="absolute left-full ml-4 w-48 p-2 bg-gray-800 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-normal z-10">{tooltip}</div>}
        </div>
    );

    return (
        <div className="fixed bottom-6 right-6 z-40">
            {isOpen && (
                <div className="absolute bottom-full mb-4 w-56 space-y-1">
                    <ActionButton icon={<EnvelopeIcon className="w-5 h-5 text-blue-500"/>} label="Send Reset Link" onClick={() => onSendReset(selectedUser)} />
                    <ActionButton icon={<KeyIcon className="w-5 h-5 text-gray-400"/>} label="View Password" onClick={() => {}} disabled={true} tooltip="For security, passwords are encrypted and cannot be viewed." />
                    <ActionButton icon={selectedUser.isBlocked ? <LockOpenIcon className="w-5 h-5 text-green-500"/> : <LockClosedIcon className="w-5 h-5 text-yellow-500"/>} label={selectedUser.isBlocked ? 'Unblock User' : 'Block User'} onClick={() => onToggleBlock(selectedUser)} />
                </div>
            )}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-16 h-16 bg-gradient-to-br from-gray-700 to-gray-900 text-white rounded-full shadow-lg flex items-center justify-center transform hover:scale-105 transition-all"
                aria-label="Admin Actions"
            >
                <CogIcon className={`w-8 h-8 transition-transform duration-300 ${isOpen ? 'rotate-90' : ''}`} />
            </button>
        </div>
    );
}

export default AdminActionsFab;
