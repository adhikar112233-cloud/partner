

import React, { useState, useMemo } from 'react';
import { User, LiveTvChannel } from '../types';
import AdSlotRequestModal from './AdSlotRequestModal';
import { SparklesIcon, VerifiedIcon } from './Icons';

interface LiveTvPageForBrandProps {
  user: User;
  channels: LiveTvChannel[];
}

const LiveTvPageForBrand: React.FC<LiveTvPageForBrandProps> = ({ user, channels }) => {
    const [selectedChannel, setSelectedChannel] = useState<LiveTvChannel | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedNiche, setSelectedNiche] = useState('All');

    const niches = useMemo(() => ['All', ...new Set(channels.map(c => c.niche))], [channels]);

    const filteredChannels = useMemo(() => {
        return channels.filter(channel => {
            const matchesSearch = searchQuery.trim() === '' ||
                channel.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                channel.description.toLowerCase().includes(searchQuery.toLowerCase());
            
            const matchesNiche = selectedNiche === 'All' || channel.niche === selectedNiche;

            return matchesSearch && matchesNiche;
        });
    }, [channels, searchQuery, selectedNiche]);


    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-gray-800">Live TV Channels</h1>
                <p className="text-gray-500 mt-1">Discover advertising opportunities with top television channels.</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <input
                    type="text"
                    placeholder="Search by channel name or description..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-grow p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
                <select
                    value={selectedNiche}
                    onChange={(e) => setSelectedNiche(e.target.value)}
                    className="p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                    {niches.map(niche => (
                        <option key={niche} value={niche}>{niche}</option>
                    ))}
                </select>
            </div>

            {filteredChannels.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredChannels.map(channel => (
                        <div key={channel.id} className="relative bg-white rounded-2xl shadow-lg overflow-hidden flex flex-col">
                            {channel.isBoosted && (
                                <div className="absolute top-3 right-3 bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-1 rounded-full flex items-center shadow-md z-10">
                                    <SparklesIcon className="w-4 h-4 mr-1" /> Boosted
                                </div>
                            )}
                            <div className="p-6 flex-grow flex flex-col">
                                <div className="flex items-center space-x-4">
                                    <img src={channel.logo} alt={channel.name} className="w-16 h-16 rounded-lg object-cover bg-gray-200"/>
                                    <div>
                                        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-1">
                                            {channel.name}
                                            {channel.isVerified && <VerifiedIcon className="w-4 h-4 text-blue-500" />}
                                        </h3>
                                        <p className="text-sm text-gray-500">{channel.niche}</p>
                                    </div>
                                </div>
                                <p className="text-sm text-gray-600 mt-4 flex-grow">{channel.description}</p>
                                <div className="mt-6 p-3 bg-gray-50 rounded-lg text-center">
                                    <p className="text-sm font-semibold text-indigo-600">{(channel.audienceSize / 1_000_000).toFixed(1)}M+ Viewers</p>
                                    <p className="text-xs text-gray-500">Estimated Audience</p>
                                </div>
                                <div className="mt-6">
                                    <button
                                        onClick={() => setSelectedChannel(channel)}
                                        className="w-full px-4 py-3 text-sm font-semibold text-white bg-gradient-to-r from-teal-400 to-indigo-600 rounded-lg shadow-md hover:shadow-lg transition-all duration-300"
                                    >
                                        Book Ad Slot
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                 <div className="text-center py-10 col-span-full bg-white rounded-lg shadow"><p className="text-gray-500">No channels match your search criteria.</p></div>
            )}
            {selectedChannel && (
                <AdSlotRequestModal
                    user={user}
                    channel={selectedChannel}
                    onClose={() => setSelectedChannel(null)}
                />
            )}
        </div>
    );
};

export default LiveTvPageForBrand;