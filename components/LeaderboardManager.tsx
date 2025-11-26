
import React, { useState, useEffect, useMemo } from 'react';
import { User, Leaderboard, LeaderboardEntry, Transaction, AnyCollaboration } from '../types';
import { apiService } from '../services/apiService';
import { TrashIcon, PencilIcon, TrophyIcon, SearchIcon } from './Icons';

interface LeaderboardManagerProps {
    allUsers: User[];
    allTransactions: Transaction[];
    allCollabs: AnyCollaboration[];
    onUpdate: () => void;
}

// Helper to convert timestamp to JS date
const toJsDate = (ts: any): Date | undefined => {
    if (!ts) return undefined;
    if (ts instanceof Date) return ts;
    if (typeof ts.toDate === 'function') return ts.toDate();
    if (typeof ts.toMillis === 'function') return new Date(ts.toMillis());
    if (typeof ts === 'string' || typeof ts === 'number') return new Date(ts);
    if (ts.seconds !== undefined && ts.nanoseconds !== undefined) return new Date(ts.seconds * 1000 + ts.nanoseconds / 1000000);
    return undefined;
};

const LeaderboardModal: React.FC<{
    leaderboard: Leaderboard | null;
    onClose: () => void;
    onSave: (data: Omit<Leaderboard, 'id' | 'createdAt'>) => void;
    allUsers: User[];
    allTransactions: Transaction[];
    allCollabs: AnyCollaboration[];
}> = ({ leaderboard, onClose, onSave, allUsers, allTransactions, allCollabs }) => {
    const [title, setTitle] = useState(leaderboard?.title || '');
    const [year, setYear] = useState(leaderboard?.year || new Date().getFullYear());
    const [type, setType] = useState<'earnings' | 'collabs'>(leaderboard?.type || 'earnings');
    const [isActive, setIsActive] = useState(leaderboard?.isActive ?? true);
    const [entries, setEntries] = useState<LeaderboardEntry[]>(leaderboard?.entries || []);
    const [isGenerating, setIsGenerating] = useState(false);
    
    // Manual Add State
    const [userSearch, setUserSearch] = useState('');
    const [showUserDropdown, setShowUserDropdown] = useState(false);

    // Filter users for manual addition
    const filteredUsers = useMemo(() => {
        if (!userSearch.trim()) return [];
        const lower = userSearch.toLowerCase();
        // Filter out users already in the list
        const existingIds = new Set(entries.map(e => e.userId));
        return allUsers.filter(u => 
            !existingIds.has(u.id) && 
            (u.name.toLowerCase().includes(lower) || u.email.toLowerCase().includes(lower))
        ).slice(0, 5);
    }, [allUsers, userSearch, entries]);

    const reRank = (currentEntries: LeaderboardEntry[]) => {
        // Sort by score descending
        const sorted = [...currentEntries].sort((a, b) => b.score - a.score);
        // Re-assign ranks
        return sorted.map((e, idx) => ({ ...e, rank: idx + 1 }));
    };

    const handleGenerate = () => {
        setIsGenerating(true);
        
        // Filter Data by Year
        const startOfYear = new Date(year, 0, 1).getTime();
        const endOfYear = new Date(year, 11, 31, 23, 59, 59).getTime();

        let computedEntries: { userId: string; score: number }[] = [];

        if (type === 'earnings') {
            // Aggregate completed payouts for influencers
            const userEarnings: Record<string, number> = {};
            allTransactions.forEach(t => {
                const tDate = toJsDate(t.timestamp)?.getTime() || 0;
                // Only count payouts that are completed
                if (t.type === 'payout' && t.status === 'completed' && tDate >= startOfYear && tDate <= endOfYear) {
                    userEarnings[t.userId] = (userEarnings[t.userId] || 0) + t.amount;
                }
            });
            
            computedEntries = Object.entries(userEarnings).map(([userId, score]) => ({ userId, score }));
        } else {
            // Aggregate completed collaborations
            const userCollabs: Record<string, number> = {};
            allCollabs.forEach(c => {
                const cDate = toJsDate(c.timestamp)?.getTime() || 0;
                // Only count completed collabs
                if ((c.status === 'completed') && cDate >= startOfYear && cDate <= endOfYear) {
                    // Identify the provider (influencer/tv/agency)
                    let providerId: string | undefined;
                    if ('influencerId' in c) providerId = c.influencerId;
                    else if ('liveTvId' in c) providerId = (c as any).liveTvId;
                    else if ('agencyId' in c) providerId = (c as any).agencyId;

                    if (providerId) {
                        userCollabs[providerId] = (userCollabs[providerId] || 0) + 1;
                    }
                }
            });
            computedEntries = Object.entries(userCollabs).map(([userId, score]) => ({ userId, score }));
        }

        // Map to LeaderboardEntry format
        let finalEntries: LeaderboardEntry[] = computedEntries.map((e, index) => {
            const user = allUsers.find(u => u.id === e.userId);
            if (!user) return null;
            return {
                userId: e.userId,
                userName: user.name || 'Unknown User',
                userAvatar: user.avatar || '',
                userRole: user.role || 'brand',
                score: e.score,
                rank: 0 // Temporary, will be fixed by reRank
            };
        }).filter((e): e is LeaderboardEntry => e !== null);

        // Take top 10 initially, but reRank handles sorting
        finalEntries = reRank(finalEntries).slice(0, 10);

        setEntries(finalEntries);
        setIsGenerating(false);
    };

    const handleAddManualUser = (user: User) => {
        const newEntry: LeaderboardEntry = {
            userId: user.id,
            userName: user.name,
            userAvatar: user.avatar,
            userRole: user.role,
            score: 0, // Default score, admin can edit
            rank: entries.length + 1
        };
        const updated = [...entries, newEntry];
        setEntries(reRank(updated));
        setUserSearch('');
        setShowUserDropdown(false);
    };

    const handleRemoveEntry = (userId: string) => {
        const updated = entries.filter(e => e.userId !== userId);
        setEntries(reRank(updated));
    };

    const handleScoreChange = (userId: string, newScore: number) => {
        const updated = entries.map(e => e.userId === userId ? { ...e, score: newScore } : e);
        setEntries(reRank(updated));
    };

    const handleSubmit = () => {
        onSave({ title, year, type, isActive, entries });
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-6 w-full max-w-3xl max-h-[90vh] overflow-y-auto flex flex-col">
                <h3 className="text-lg font-bold mb-4 dark:text-gray-100">{leaderboard ? 'Edit Leaderboard' : 'Create Leaderboard'}</h3>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4 flex-shrink-0">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Title</label>
                        <input value={title} onChange={e => setTitle(e.target.value)} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="Top 10 Earners 2024" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Year</label>
                        <input type="number" value={year} onChange={e => setYear(Number(e.target.value))} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Type</label>
                        <select value={type} onChange={e => setType(e.target.value as any)} className="mt-1 w-full p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                            <option value="earnings">Earnings (Payouts)</option>
                            <option value="collabs">Collaborations</option>
                        </select>
                    </div>
                    <div className="flex items-end pb-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" checked={isActive} onChange={e => setIsActive(e.target.checked)} className="h-4 w-4 text-indigo-600" />
                            <span className="text-sm text-gray-700 dark:text-gray-300">Is Active (Visible to Users)</span>
                        </label>
                    </div>
                </div>

                <div className="flex justify-between items-center mb-2 flex-shrink-0">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">Entries ({entries.length})</label>
                    <button onClick={handleGenerate} disabled={isGenerating} className="text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200 flex items-center gap-1">
                        <TrophyIcon className="w-4 h-4" />
                        {isGenerating ? 'Calculating...' : 'Auto-Select Top Users'}
                    </button>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700 rounded border dark:border-gray-600 flex-1 overflow-y-auto mb-4">
                    {entries.length === 0 ? (
                        <p className="text-center p-8 text-gray-500 dark:text-gray-400 text-sm">List is empty. Use Auto-Select or Add Users manually.</p>
                    ) : (
                        <table className="w-full text-sm text-left">
                            <thead className="bg-gray-100 dark:bg-gray-600 sticky top-0 z-10">
                                <tr>
                                    <th className="p-3 w-16 text-center">Rank</th>
                                    <th className="p-3">User</th>
                                    <th className="p-3 text-right">{type === 'earnings' ? 'Earnings (₹)' : 'Count'}</th>
                                    <th className="p-3 w-16 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {entries.map((entry, idx) => (
                                    <tr key={entry.userId} className="border-t dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600">
                                        <td className="p-2 text-center font-bold text-gray-500">#{entry.rank}</td>
                                        <td className="p-2">
                                            <div className="flex items-center gap-2">
                                                <img src={entry.userAvatar} className="w-8 h-8 rounded-full object-cover bg-gray-200" alt="" />
                                                <div>
                                                    <p className="font-medium dark:text-white">{entry.userName}</p>
                                                    <p className="text-xs text-gray-500 capitalize">{entry.userRole}</p>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-2 text-right">
                                            <input 
                                                type="number" 
                                                value={entry.score} 
                                                onChange={(e) => handleScoreChange(entry.userId, Number(e.target.value))}
                                                className="w-24 p-1 text-right border rounded dark:bg-gray-800 dark:border-gray-500 dark:text-white"
                                            />
                                        </td>
                                        <td className="p-2 text-center">
                                            <button onClick={() => handleRemoveEntry(entry.userId)} className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/30" title="Remove from list">
                                                <TrashIcon className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                <div className="mb-4 relative flex-shrink-0">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Add Random User to List</label>
                    <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <SearchIcon className="h-4 w-4 text-gray-400" />
                        </div>
                        <input
                            type="text"
                            className="w-full pl-10 p-2 border rounded-md dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            placeholder="Search user by name or email..."
                            value={userSearch}
                            onChange={(e) => { setUserSearch(e.target.value); setShowUserDropdown(true); }}
                            onFocus={() => setShowUserDropdown(true)}
                        />
                    </div>
                    {showUserDropdown && userSearch && (
                        <div className="absolute z-20 w-full mt-1 bg-white dark:bg-gray-800 border dark:border-gray-600 rounded-md shadow-lg max-h-40 overflow-auto">
                            {filteredUsers.length === 0 ? (
                                <div className="p-2 text-sm text-gray-500 dark:text-gray-400">No users found or already added.</div>
                            ) : (
                                filteredUsers.map(u => (
                                    <button
                                        key={u.id}
                                        onClick={() => handleAddManualUser(u)}
                                        className="w-full text-left p-2 hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2"
                                    >
                                        <img src={u.avatar} className="w-6 h-6 rounded-full" alt="" />
                                        <div>
                                            <p className="text-sm font-medium dark:text-gray-200">{u.name}</p>
                                            <p className="text-xs text-gray-500">{u.email}</p>
                                        </div>
                                    </button>
                                ))
                            )}
                        </div>
                    )}
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t dark:border-gray-700 flex-shrink-0">
                    <button onClick={onClose} className="px-4 py-2 text-gray-600 bg-gray-200 rounded hover:bg-gray-300 dark:bg-gray-600 dark:text-gray-200">Cancel</button>
                    <button onClick={handleSubmit} disabled={entries.length === 0} className="px-4 py-2 text-white bg-indigo-600 rounded hover:bg-indigo-700 disabled:opacity-50">Save Leaderboard</button>
                </div>
            </div>
        </div>
    );
};

const LeaderboardManager: React.FC<LeaderboardManagerProps> = ({ allUsers, allTransactions, allCollabs, onUpdate }) => {
    const [leaderboards, setLeaderboards] = useState<Leaderboard[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingBoard, setEditingBoard] = useState<Leaderboard | null>(null);

    const fetchLeaderboards = async () => {
        setIsLoading(true);
        try {
            const data = await apiService.getLeaderboards();
            setLeaderboards(data);
        } catch (e) {
            console.error(e);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchLeaderboards();
    }, []);

    const handleSave = async (data: Omit<Leaderboard, 'id' | 'createdAt'>) => {
        try {
            if (editingBoard) {
                await apiService.updateLeaderboard(editingBoard.id, data);
            } else {
                await apiService.createLeaderboard(data);
            }
            fetchLeaderboards();
            onUpdate();
        } catch (e) {
            console.error("Failed to save leaderboard", e);
            alert("Failed to save.");
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm("Are you sure you want to delete this leaderboard?")) {
            await apiService.deleteLeaderboard(id);
            fetchLeaderboards();
            onUpdate();
        }
    };

    return (
        <div className="p-6 h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100">Manage Leaderboards</h2>
                <button onClick={() => { setEditingBoard(null); setIsModalOpen(true); }} className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center gap-2">
                    <TrophyIcon className="w-5 h-5" /> Create New
                </button>
            </div>

            {isLoading ? <p className="dark:text-gray-300">Loading...</p> : leaderboards.length === 0 ? (
                <div className="text-center py-10 bg-white dark:bg-gray-800 rounded-lg shadow"><p className="text-gray-500 dark:text-gray-400">No leaderboards created yet.</p></div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {leaderboards.map(board => (
                        <div key={board.id} className={`bg-white dark:bg-gray-800 rounded-xl shadow p-5 border-l-4 ${board.isActive ? 'border-green-500' : 'border-gray-300'}`}>
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="font-bold text-lg dark:text-white">{board.title}</h3>
                                    <p className="text-sm text-gray-500 dark:text-gray-400">{board.year} • <span className="capitalize">{board.type}</span></p>
                                </div>
                                <span className={`text-xs px-2 py-1 rounded-full ${board.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                                    {board.isActive ? 'Active' : 'Draft'}
                                </span>
                            </div>
                            <div className="mt-4 pt-4 border-t dark:border-gray-700 flex justify-end gap-2">
                                <button onClick={() => { setEditingBoard(board); setIsModalOpen(true); }} className="p-2 text-blue-600 hover:bg-blue-50 rounded"><PencilIcon className="w-5 h-5" /></button>
                                <button onClick={() => handleDelete(board.id)} className="p-2 text-red-600 hover:bg-red-50 rounded"><TrashIcon className="w-5 h-5" /></button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {isModalOpen && (
                <LeaderboardModal 
                    leaderboard={editingBoard}
                    onClose={() => setIsModalOpen(false)}
                    onSave={handleSave}
                    allUsers={allUsers}
                    allTransactions={allTransactions}
                    allCollabs={allCollabs}
                />
            )}
        </div>
    );
};

export default LeaderboardManager;
