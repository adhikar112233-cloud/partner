
import React, { useState } from 'react';
import { User, Transaction, PayoutRequest, AnyCollaboration, UserRole, MembershipPlan } from '../types';
import { apiService } from '../services/apiService';
import { authService } from '../services/authService';
import UserDetailView from './UserDetailView';
import { SearchIcon, TrashIcon, LockClosedIcon, LockOpenIcon, CheckBadgeIcon, ExclamationTriangleIcon } from './Icons';

interface UserManagementPanelProps {
    allUsers: User[];
    onUpdate: () => void;
    transactions: Transaction[];
    payouts: PayoutRequest[];
    collabs: AnyCollaboration[];
}

const UserManagementPanel: React.FC<UserManagementPanelProps> = ({ allUsers, onUpdate, transactions, payouts, collabs }) => {
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    
    // Confirmation Modal State
    const [confirmation, setConfirmation] = useState<{ type: 'block' | 'delete', user: User } | null>(null);

    // Create User State
    const [newUser, setNewUser] = useState({
        name: '',
        email: '',
        role: 'brand' as UserRole,
        mobileNumber: '',
        password: '',
        membershipPlan: 'free' as MembershipPlan
    });

    const filteredUsers = allUsers.filter(u => 
        u.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (u.piNumber && u.piNumber.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        try {
            await authService.createUserByAdmin(
                newUser.email,
                newUser.password,
                newUser.role,
                newUser.name,
                newUser.mobileNumber,
                newUser.membershipPlan
            );
            alert('User created successfully!');
            setIsCreateModalOpen(false);
            setNewUser({ name: '', email: '', role: 'brand', mobileNumber: '', password: '', membershipPlan: 'free' });
            onUpdate();
        } catch (error: any) {
            alert(`Failed to create user: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const requestToggleBlock = (user: User) => {
        setConfirmation({ type: 'block', user });
    };

    const requestDelete = (user: User) => {
        setConfirmation({ type: 'delete', user });
    };

    const executeConfirmation = async () => {
        if (!confirmation) return;
        const { type, user } = confirmation;
        
        setIsLoading(true); 
        
        try {
            if (type === 'block') {
                 await apiService.updateUser(user.id, { isBlocked: !user.isBlocked });
            } else if (type === 'delete') {
                 // Soft delete by blocking and renaming
                 await apiService.updateUser(user.id, { isBlocked: true, name: `[DELETED] ${user.name}` }); 
            }
            onUpdate();
        } catch (error) {
            console.error("Action failed:", error);
            alert("Action failed. Please try again.");
        } finally {
            setIsLoading(false);
            setConfirmation(null);
        }
    };

    return (
        <div className="p-4 sm:p-6 h-full flex flex-col">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">User Management</h2>
                <button onClick={() => setIsCreateModalOpen(true)} className="w-full sm:w-auto px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition-colors">
                    + Create User
                </button>
            </div>

            <div className="mb-4 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none"><SearchIcon className="h-5 w-5 text-gray-400" /></div>
                <input 
                    type="text" 
                    placeholder="Search users by name, email, or ID..." 
                    className="pl-10 w-full p-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white focus:ring-2 focus:ring-indigo-500 transition-all"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            <div className="flex-1 overflow-hidden bg-white dark:bg-gray-800 rounded-xl shadow-sm border dark:border-gray-700 flex flex-col">
                <div className="overflow-x-auto overflow-y-auto flex-1">
                    <table className="min-w-[1000px] w-full text-left border-collapse">
                        <thead className="bg-gray-50 dark:bg-gray-700 border-b dark:border-gray-600 sticky top-0 z-10 shadow-sm">
                            <tr>
                                <th className="p-4 font-medium text-gray-500 dark:text-gray-300 whitespace-nowrap w-32">User ID</th>
                                <th className="p-4 font-medium text-gray-500 dark:text-gray-300 whitespace-nowrap w-48">User Name</th>
                                <th className="p-4 font-medium text-gray-500 dark:text-gray-300 whitespace-nowrap w-32">User Type</th>
                                <th className="p-4 font-medium text-gray-500 dark:text-gray-300 whitespace-nowrap w-48">Email ID</th>
                                <th className="p-4 font-medium text-gray-500 dark:text-gray-300 whitespace-nowrap w-32">Mobile Number</th>
                                <th className="p-4 font-medium text-gray-500 dark:text-gray-300 whitespace-nowrap w-32">Membership</th>
                                <th className="p-4 font-medium text-gray-500 dark:text-gray-300 whitespace-nowrap text-center w-40">Action</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                            {filteredUsers.map(user => (
                                <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                                    <td className="p-4 font-mono text-xs text-gray-500 dark:text-gray-400 whitespace-nowrap">{user.piNumber || 'N/A'}</td>
                                    <td className="p-4 font-medium text-gray-900 dark:text-gray-100 whitespace-nowrap">
                                        <div className="flex items-center gap-2">
                                            <img src={user.avatar} alt="" className="w-8 h-8 rounded-full object-cover" />
                                            <span className="truncate max-w-[150px]" title={user.name}>{user.name}</span>
                                            {user.kycStatus === 'approved' && <CheckBadgeIcon className="w-4 h-4 text-blue-500 flex-shrink-0" />}
                                        </div>
                                    </td>
                                    <td className="p-4 capitalize text-gray-600 dark:text-gray-300 whitespace-nowrap">
                                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                            user.role === 'staff' ? 'bg-purple-100 text-purple-800' : 
                                            user.role === 'brand' ? 'bg-blue-100 text-blue-800' : 
                                            'bg-green-100 text-green-800'
                                        }`}>
                                            {user.role}
                                        </span>
                                    </td>
                                    <td className="p-4 text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap truncate max-w-[200px]" title={user.email}>{user.email}</td>
                                    <td className="p-4 text-sm text-gray-600 dark:text-gray-300 whitespace-nowrap">{user.mobileNumber || '-'}</td>
                                    <td className="p-4 text-sm whitespace-nowrap">
                                        <span className={`px-2 py-1 rounded text-xs font-semibold ${user.membership?.isActive ? 'bg-teal-100 text-teal-800' : 'bg-gray-100 text-gray-800'}`}>
                                            {user.membership?.plan.replace(/_/g, ' ') || 'Free'}
                                        </span>
                                    </td>
                                    <td className="p-4 text-center whitespace-nowrap">
                                        <div className="flex items-center justify-center gap-2">
                                            <button 
                                                onClick={() => requestToggleBlock(user)} 
                                                className={`p-1.5 rounded-md transition-colors ${user.isBlocked ? 'bg-red-100 text-red-600 hover:bg-red-200' : 'bg-green-100 text-green-600 hover:bg-green-200'}`} 
                                                title={user.isBlocked ? 'Unblock User' : 'Block User'}
                                            >
                                                {user.isBlocked ? <LockClosedIcon className="w-4 h-4" /> : <LockOpenIcon className="w-4 h-4" />}
                                            </button>
                                            <button 
                                                onClick={() => requestDelete(user)} 
                                                className="p-1.5 bg-gray-100 text-gray-500 rounded-md hover:bg-red-100 hover:text-red-600 transition-colors" 
                                                title="Delete User"
                                            >
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                            <button 
                                                onClick={() => setSelectedUser(user)} 
                                                className="text-xs font-medium text-white bg-indigo-600 hover:bg-indigo-700 px-3 py-1.5 rounded-md shadow-sm transition-colors"
                                            >
                                                View Details
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* User Detail Modal */}
            {selectedUser && (
                <UserDetailView 
                    user={selectedUser} 
                    onClose={() => setSelectedUser(null)} 
                    onUpdateUser={onUpdate}
                    transactions={transactions}
                    payouts={payouts}
                    collabs={collabs}
                />
            )}

            {/* Create User Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-md">
                        <h3 className="text-xl font-bold mb-4 dark:text-white">Create New User</h3>
                        <form onSubmit={handleCreateUser} className="space-y-3">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Full Name</label>
                                <input type="text" placeholder="John Doe" required value={newUser.name} onChange={e => setNewUser({...newUser, name: e.target.value})} className="w-full p-2 border rounded dark:bg-gray-700 dark:text-white" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Email ID</label>
                                <input type="email" placeholder="john@example.com" required value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} className="w-full p-2 border rounded dark:bg-gray-700 dark:text-white" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Password</label>
                                <input type="password" placeholder="******" required value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} className="w-full p-2 border rounded dark:bg-gray-700 dark:text-white" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Mobile Number</label>
                                <input type="tel" placeholder="10-digit number" required value={newUser.mobileNumber} onChange={e => setNewUser({...newUser, mobileNumber: e.target.value})} className="w-full p-2 border rounded dark:bg-gray-700 dark:text-white" />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">User Type</label>
                                <select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value as UserRole})} className="w-full p-2 border rounded dark:bg-gray-700 dark:text-white">
                                    <option value="brand">Brand</option>
                                    <option value="influencer">Influencer</option>
                                    <option value="livetv">Live TV</option>
                                    <option value="banneragency">Banner Agency</option>
                                    <option value="staff">Staff</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Membership Plan</label>
                                <select value={newUser.membershipPlan} onChange={e => setNewUser({...newUser, membershipPlan: e.target.value as MembershipPlan})} className="w-full p-2 border rounded dark:bg-gray-700 dark:text-white">
                                    <option value="free">Free</option>
                                    <option value="basic">Basic</option>
                                    <option value="pro">Pro</option>
                                    <option value="premium">Premium</option>
                                    <option value="pro_10">Pro 10</option>
                                    <option value="pro_20">Pro 20</option>
                                    <option value="pro_unlimited">Pro Unlimited</option>
                                </select>
                            </div>
                            <div className="flex justify-end gap-3 mt-4">
                                <button type="button" onClick={() => setIsCreateModalOpen(false)} className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded dark:text-gray-300 dark:hover:bg-gray-700">Cancel</button>
                                <button type="submit" disabled={isLoading} className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 disabled:opacity-50">{isLoading ? 'Creating...' : 'Create User'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Confirmation Modal */}
            {confirmation && (
                <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-[70] p-4" onClick={() => setConfirmation(null)}>
                    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-2xl p-6 w-full max-w-sm transform transition-all scale-100" onClick={e => e.stopPropagation()}>
                        <div className="flex items-center gap-4 mb-4">
                            <div className={`p-3 rounded-full ${confirmation.type === 'delete' || (confirmation.type === 'block' && !confirmation.user.isBlocked) ? 'bg-red-100 text-red-600' : 'bg-indigo-100 text-indigo-600'}`}>
                                {confirmation.type === 'delete' ? <TrashIcon className="w-6 h-6" /> : <ExclamationTriangleIcon className="w-6 h-6" />}
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                                    {confirmation.type === 'delete' ? 'Delete User?' : (confirmation.user.isBlocked ? 'Unblock User?' : 'Block User?')}
                                </h3>
                            </div>
                        </div>
                        
                        <p className="text-gray-600 dark:text-gray-300 mb-6">
                            {confirmation.type === 'delete' 
                                ? `Are you sure you want to delete ${confirmation.user.name}? This will permanently disable access.`
                                : confirmation.user.isBlocked
                                    ? `Are you sure you want to unblock ${confirmation.user.name}? They will regain access immediately.`
                                    : `Are you sure you want to block ${confirmation.user.name}? They will lose access to the platform.`
                            }
                        </p>

                        <div className="flex justify-end gap-3">
                            <button 
                                onClick={() => setConfirmation(null)}
                                disabled={isLoading}
                                className="px-4 py-2 text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600 transition-colors"
                            >
                                Cancel
                            </button>
                            <button 
                                onClick={executeConfirmation}
                                disabled={isLoading}
                                className={`px-4 py-2 text-white font-semibold rounded-lg shadow-md transition-colors disabled:opacity-50 ${
                                    confirmation.type === 'delete' || (confirmation.type === 'block' && !confirmation.user.isBlocked)
                                    ? 'bg-red-600 hover:bg-red-700' 
                                    : 'bg-indigo-600 hover:bg-indigo-700'
                                }`}
                            >
                                {isLoading ? 'Processing...' : 'Confirm'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserManagementPanel;
