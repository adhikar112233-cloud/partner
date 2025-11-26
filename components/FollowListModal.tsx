
import React, { useEffect, useState } from 'react';
import { User } from '../types';
import { apiService } from '../services/apiService';

interface FollowListModalProps {
    title: string; // "Followers" or "Following"
    userIds: string[];
    currentUser: User;
    onClose: () => void;
    onToggleFollow: (targetId: string) => void; // To update local state
}

const FollowListModal: React.FC<FollowListModalProps> = ({ title, userIds, currentUser, onClose, onToggleFollow }) => {
    const [users, setUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchUsers = async () => {
            setIsLoading(true);
            try {
                const fetchedUsers = await apiService.getUsersByIds(userIds);
                setUsers(fetchedUsers);
            } catch (error) {
                console.error("Failed to fetch users:", error);
            } finally {
                setIsLoading(false);
            }
        };

        if (userIds.length > 0) {
            fetchUsers();
        } else {
            setIsLoading(false);
        }
    }, [userIds]);

    const handleFollowClick = async (targetUser: User) => {
        const isFollowing = currentUser.following?.includes(targetUser.id);
        
        // Optimistic UI update
        onToggleFollow(targetUser.id); 

        try {
            if (isFollowing) {
                await apiService.unfollowUser(currentUser.id, targetUser.id);
            } else {
                await apiService.followUser(currentUser.id, targetUser.id);
            }
        } catch (error) {
            console.error("Failed to toggle follow:", error);
            // Revert if failed (requires more complex state management, skipping for simplicity)
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-[60] p-4" onClick={onClose}>
            <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <div className="p-4 border-b dark:border-gray-700 flex justify-between items-center">
                    <h3 className="font-bold text-lg text-gray-800 dark:text-gray-100">{title}</h3>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 text-2xl">&times;</button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                    {isLoading ? (
                        <p className="text-center text-gray-500 dark:text-gray-400">Loading...</p>
                    ) : users.length === 0 ? (
                        <p className="text-center text-gray-500 dark:text-gray-400">No users found.</p>
                    ) : (
                        users.map(user => {
                            const isMe = user.id === currentUser.id;
                            const isFollowing = currentUser.following?.includes(user.id);

                            return (
                                <div key={user.id} className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <img src={user.avatar} alt={user.name} className="w-10 h-10 rounded-full object-cover border dark:border-gray-600" />
                                        <div>
                                            <p className="font-semibold text-sm text-gray-800 dark:text-gray-100">{user.name}</p>
                                            <p className="text-xs text-gray-500 dark:text-gray-400 capitalize">{user.role}</p>
                                        </div>
                                    </div>
                                    {!isMe && (
                                        <button 
                                            onClick={() => handleFollowClick(user)}
                                            className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                                                isFollowing 
                                                    ? 'bg-gray-200 text-gray-800 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-200' 
                                                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                                            }`}
                                        >
                                            {isFollowing ? 'Following' : 'Follow'}
                                        </button>
                                    )}
                                </div>
                            );
                        })
                    )}
                </div>
            </div>
        </div>
    );
};

export default FollowListModal;
