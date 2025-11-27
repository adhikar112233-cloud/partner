
import React, { useState, useMemo } from 'react';
import { User, Transaction, PayoutRequest, AnyCollaboration, UserRole } from '../types';
import { apiService } from '../services/apiService';
import { authService } from '../services/authService';
import UserDetailView from './UserDetailView';
import { SearchIcon, TrashIcon, LockClosedIcon, LockOpenIcon, CheckBadgeIcon, KeyIcon, EnvelopeIcon, PencilIcon, ExclamationTriangleIcon } from './Icons';

interface UserManagementPanelProps {
    allUsers: User[];
    onUpdate: () => void;
    transactions: Transaction[];
    payouts: PayoutRequest[];
    collabs: AnyCollaboration[];
}

const PasswordManagementModal: React.FC<{ user: User; onClose: () => void }> = ({ user, onClose }) => {
    const [activeTab, setActiveTab] = useState<'reset' | 'manual'>('reset');
    const [newPassword, setNewPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [copied, setCopied] = useState(false);

    const handleSendReset = async () => {
        setIsLoading(true);
        setMessage(null);
        try {
            await authService.sendPasswordResetEmail(user.email);
            setMessage({ type: 'success', text: `Password reset email sent to ${user.email}` });
        } catch (err: any) {
            setMessage({ type: 'error', text: err.message || 'Failed to send reset email.' });
        } finally {
            setIsLoading(false);
        }
    };

    const generatePassword = () => {
        const chars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*";
        const array = new Uint32Array(12);
        window.crypto.getRandomValues(array);
        let pass = "";
        for (let i = 0; i < 12; i++) {
            pass += chars.charAt(array[i] % chars.length);
        }
        setNewPassword(pass);
        setShowPassword(true); 
    };

    const handleManualUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword.length < 6) {
            setMessage({ type: 'error', text: 'Password must be at least 6 characters.' });
            return;
        }
        
        setIsLoading(true);
        setMessage(null);
        try {
            await apiService.adminChangePassword(user.id, newPassword);
            setMessage({ type: 'success', text: 'Password updated successfully. The user can now login with this password.' });
        } catch (err: any) {
            console.error(err);
            setMessage({ type: 'error', text: err.message || 'Failed to update password.' });
        } finally {
            setIsLoading(false);
        }
    };

    const copyToClipboard = () => {
        navigator.clipboard.writeText(newPassword);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-[70] p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-xl font-bold dark:text-white">Manage Password</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-xl">&times;</button>
                </div>
                
                <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">For user: <span className="font-semibold text-gray-800 dark:text-gray-200">{user.name}</span></p>

                <div className="flex border-b border-gray-200 dark:border-gray-700 mb-6">
                    <button 
                        onClick={() => { setActiveTab('reset'); setMessage(null); }}
                        className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'reset' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
                    >
                        Send Reset Link
                    </button>
                    <button 
                        onClick={() => { setActiveTab('manual'); setMessage(null); }}
                        className={`flex-1 py-2 text-sm font-medium border-b-2 transition-colors ${activeTab === 'manual' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400 dark:border-indigo-400' : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'}`}
                    >
                        Set Manually
                    </button>
                </div>

                {message && (
                    <div className={`p-3 rounded-lg mb-4 text-sm ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                        {message.text}
                    </div>
                )}

                {activeTab === 'reset' && (
                    <div className="space-y-4">
                        <div className="bg-blue-50 text-blue-800 p-4 rounded-lg border border-blue-100 dark:bg-blue-900/20 dark:text-blue-200 dark:border-blue-800">
                            <p className="text-sm">
                                Send a system-generated password reset email to <strong>{user.email}</strong>. This is the safest method as the user sets their own password.
                            </p>
                        </div>
                        <button 
                            onClick={handleSendReset}
                            disabled={isLoading}
                            className="w-full py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2 font-medium"
                        >
                            <EnvelopeIcon className="w-4 h-4" />
                            {isLoading ? 'Sending...' : 'Send Reset Email'}
                        </button>
                    </div>
                )}

                {activeTab === 'manual' && (
                    <form onSubmit={handleManualUpdate} className="space-y-4">
                        <div className="bg-yellow-50 text-yellow-800 p-3 rounded-lg text-sm border border-yellow-200 flex items-start gap-2 dark:bg-yellow-900/20 dark:text-yellow-200 dark:border-yellow-800">
                            <ExclamationTriangleIcon className="w-5 h-5 flex-shrink-0 mt-0.5" />
                            <p>Manually override the user's password. Use this if the user cannot access their email.</p>
                        </div>
                        
                        <div className="space-y-2">
                            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">New Password</label>
                            <div className="relative">
                                <input 
                                    type={showPassword ? "text" : "password"}
                                    value={newPassword}
                                    onChange={e => setNewPassword(e.target.value)}
                                    placeholder="Enter new password"
                                    className="w-full p-2.5 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white pr-16 focus:ring-2 focus:ring-indigo-500 outline-none transition-all"
                                    required
                                    minLength={6}
                                />
                                <button 
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-3 top-3 text-xs font-semibold text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 uppercase"
                                >
                                    {showPassword ? 'Hide' : 'Show'}
                                </button>
                            </div>
                        </div>

                        <div className="flex justify-between gap-3">
                            <button 
                                type="button"
                                onClick={generatePassword}
                                className="flex-1 py-2 px-3 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:hover:bg-gray-600 transition-colors font-medium border border-gray-200 dark:border-gray-600"
                            >
                                Generate Random
                            </button>
                            <button 
                                type="button"
                                onClick={copyToClipboard}
                                disabled={!newPassword}
                                className={`py-2 px-4 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2 ${copied ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-gray-100 text-gray-700 border border-gray-200 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-200 dark:border-gray-600'}`}
                            >
                                {copied ? 'Copied' : 'Copy'}
                            </button>
                        </div>

                        <button 
                            type="submit"
                            disabled={isLoading}
                            className="w-full py-2.5 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2 mt-2 font-bold shadow-md"
                        >
                            <KeyIcon className="w-4 h-4" />
                            {isLoading ? 'Updating Password...' : 'Update Password'}
                        </button>
                    </form>
                )}
            </div>
        </div>
    );
};

const UserManagementPanel: React.FC<UserManagementPanelProps> = ({ allUsers, onUpdate, transactions, payouts, collabs }) => {
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [passwordModalUser, setPasswordModalUser] = useState<User | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');

    const filteredUsers = useMemo(() => {
        let filtered = allUsers;
        if (roleFilter !== 'all') {
            filtered = filtered.filter(u => u.role === roleFilter);
        }
        if (searchQuery) {
            const lower = searchQuery.toLowerCase();
            filtered = filtered.filter(u => 
                u.name.toLowerCase().includes(lower) || 
                u.email.toLowerCase().includes(lower) || 
                (u.companyName && u.companyName.toLowerCase().includes(lower)) ||
                (u.piNumber && u.piNumber.toLowerCase().includes(lower))
            );
        }
        return filtered;
    }, [allUsers, roleFilter, searchQuery]);

    const handleBlockToggle = async (user: User) => {
        if (window.confirm(`Are you sure you want to ${user.isBlocked ? 'unblock' : 'block'} this user?`)) {
            await apiService.updateUser(user.id, { isBlocked: !user.isBlocked });
            onUpdate();
        }
    };

    return (
        <div className="p-6 h-full flex flex-col">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">User Management</h2>
                <div className="flex gap-2 w-full sm:w-auto">
                    <div className="relative flex-grow sm:flex-grow-0">
                        <input 
                            type="text" 
                            placeholder="Search users..." 
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            className="w-full sm:w-64 pl-9 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                        />
                        <SearchIcon className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    </div>
                    <select 
                        value={roleFilter} 
                        onChange={e => setRoleFilter(e.target.value as any)} 
                        className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-indigo-500 dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                    >
                        <option value="all">All Roles</option>
                        <option value="brand">Brand</option>
                        <option value="influencer">Influencer</option>
                        <option value="livetv">Live TV</option>
                        <option value="banneragency">Banner Agency</option>
                        <option value="staff">Staff</option>
                    </select>
                </div>
            </div>

            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden flex-1 flex flex-col">
                <div className="overflow-auto flex-1">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-gray-50 dark:bg-gray-700/50 sticky top-0 z-10">
                            <tr className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase border-b dark:border-gray-700">
                                <th className="p-4">User</th>
                                <th className="p-4">Role</th>
                                <th className="p-4">Status</th>
                                <th className="p-4">KYC</th>
                                <th className="p-4 text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {filteredUsers.map(user => (
                                <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors">
                                    <td className="p-4">
                                        <div className="flex items-center gap-3">
                                            <img src={user.avatar} alt="" className="w-10 h-10 rounded-full object-cover bg-gray-200" />
                                            <div>
                                                <div className="font-medium text-gray-900 dark:text-white">{user.name}</div>
                                                <div className="text-xs text-gray-500 dark:text-gray-400">{user.email}</div>
                                                <div className="text-xs text-gray-400 font-mono">{user.piNumber}</div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4 capitalize text-gray-600 dark:text-gray-300">{user.role}</td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${user.isBlocked ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                                            {user.isBlocked ? 'Blocked' : 'Active'}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        {user.kycStatus === 'approved' ? <CheckBadgeIcon className="w-5 h-5 text-green-500" /> : 
                                         user.kycStatus === 'pending' ? <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">Pending</span> :
                                         <span className="text-gray-400 text-xs">-</span>}
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="flex justify-end gap-2">
                                            <button onClick={() => setSelectedUser(user)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded dark:hover:bg-gray-700" title="View Details">
                                                <PencilIcon className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => setPasswordModalUser(user)} className="p-1.5 text-indigo-500 hover:bg-indigo-50 rounded dark:hover:bg-indigo-900/30" title="Manage Password">
                                                <KeyIcon className="w-4 h-4" />
                                            </button>
                                            <button onClick={() => handleBlockToggle(user)} className={`p-1.5 rounded ${user.isBlocked ? 'text-green-600 hover:bg-green-50' : 'text-red-600 hover:bg-red-50'}`} title={user.isBlocked ? 'Unblock' : 'Block'}>
                                                {user.isBlocked ? <LockOpenIcon className="w-4 h-4" /> : <LockClosedIcon className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filteredUsers.length === 0 && (
                        <div className="p-8 text-center text-gray-500 dark:text-gray-400">No users found matching your criteria.</div>
                    )}
                </div>
            </div>

            {selectedUser && (
                <UserDetailView 
                    user={selectedUser} 
                    users={filteredUsers} // Pass the filtered list for navigation
                    onSelectUser={setSelectedUser} // Pass the handler to update selected user
                    onClose={() => setSelectedUser(null)} 
                    onUpdateUser={onUpdate}
                    transactions={transactions}
                    payouts={payouts}
                    collabs={collabs}
                />
            )}

            {passwordModalUser && (
                <PasswordManagementModal 
                    user={passwordModalUser} 
                    onClose={() => setPasswordModalUser(null)} 
                />
            )}
        </div>
    );
};

export default UserManagementPanel;
