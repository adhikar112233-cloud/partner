
import React, { useState, useEffect } from 'react';
import { Leaderboard, LeaderboardEntry } from '../types';
import { apiService } from '../services/apiService';
import { TrophyIcon, ChevronDownIcon } from './Icons';

const RankBadge: React.FC<{ rank: number }> = ({ rank }) => {
    if (rank === 1) return <span className="text-2xl">🥇</span>;
    if (rank === 2) return <span className="text-2xl">🥈</span>;
    if (rank === 3) return <span className="text-2xl">🥉</span>;
    return <span className="font-bold text-gray-500 w-8 text-center">#{rank}</span>;
};

const LeaderboardCard: React.FC<{ board: Leaderboard }> = ({ board }) => {
    const [isOpen, setIsOpen] = useState(false);

    return (
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg overflow-hidden transition-all duration-300">
            <div 
                className="p-6 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/50 flex justify-between items-center"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-full ${board.type === 'earnings' ? 'bg-yellow-100 text-yellow-600' : 'bg-blue-100 text-blue-600'}`}>
                        <TrophyIcon className="w-8 h-8" />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-gray-800 dark:text-white">{board.title}</h3>
                        <p className="text-sm text-gray-500 dark:text-gray-400">Top 10 {board.type === 'earnings' ? 'Highest Earners' : 'Most Active Creators'}</p>
                    </div>
                </div>
                <ChevronDownIcon className={`w-6 h-6 text-gray-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`} />
            </div>

            {isOpen && (
                <div className="border-t dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-100 dark:bg-gray-900 text-xs uppercase text-gray-500 dark:text-gray-400">
                                <tr>
                                    <th className="p-4 text-center w-16">Rank</th>
                                    <th className="p-4">User</th>
                                    <th className="p-4 text-right">{board.type === 'earnings' ? 'Earnings' : 'Collabs'}</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                                {board.entries.map((entry) => (
                                    <tr key={entry.userId} className="hover:bg-white dark:hover:bg-gray-700 transition-colors">
                                        <td className="p-4 text-center flex justify-center items-center h-full">
                                            <RankBadge rank={entry.rank} />
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-3">
                                                <img src={entry.userAvatar || 'https://via.placeholder.com/40'} alt="" className="w-10 h-10 rounded-full border-2 border-white shadow-sm object-cover" />
                                                <div>
                                                    <p className="font-semibold text-gray-900 dark:text-white">{entry.userName}</p>
                                                    <span className="text-xs px-2 py-0.5 bg-gray-200 dark:bg-gray-600 rounded-full text-gray-600 dark:text-gray-300 capitalize">{entry.userRole}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="p-4 text-right font-mono font-bold text-indigo-600 dark:text-indigo-400">
                                            {board.type === 'earnings' ? `₹${entry.score.toLocaleString()}` : entry.score}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};

const LeaderboardPage: React.FC = () => {
    const [leaderboards, setLeaderboards] = useState<Leaderboard[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchBoards = async () => {
            setIsLoading(true);
            try {
                const data = await apiService.getActiveLeaderboards();
                setLeaderboards(data);
            } catch (e) {
                console.error(e);
            } finally {
                setIsLoading(false);
            }
        };
        fetchBoards();
    }, []);

    return (
        <div className="max-w-5xl mx-auto space-y-8 p-4">
            <div className="text-center py-8">
                <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-yellow-500 to-orange-600 mb-2">
                    Hall of Fame
                </h1>
                <p className="text-lg text-gray-600 dark:text-gray-300">Celebrating the top performers of BIGYAPON.</p>
            </div>

            {isLoading ? (
                <div className="text-center py-20"><p className="text-gray-500">Loading leaderboards...</p></div>
            ) : leaderboards.length === 0 ? (
                <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-2xl shadow-lg">
                    <TrophyIcon className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-500 dark:text-gray-400">No leaderboards have been published yet. Check back soon!</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {leaderboards.map(board => <LeaderboardCard key={board.id} board={board} />)}
                </div>
            )}
        </div>
    );
};

export default LeaderboardPage;
