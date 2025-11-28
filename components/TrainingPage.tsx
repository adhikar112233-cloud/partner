


import React from 'react';
import { User, PlatformSettings, TrainingVideo } from '../types';
import { YoutubeIcon, AcademicCapIcon } from './Icons';

interface TrainingPageProps {
    user: User;
    platformSettings: PlatformSettings;
}

const TrainingPage: React.FC<TrainingPageProps> = ({ user, platformSettings }) => {
    // Determine user role group
    let roleKey: 'brand' | 'influencer' | 'livetv' | 'banneragency' | null = null;
    if (user.role === 'brand') roleKey = 'brand';
    else if (user.role === 'influencer') roleKey = 'influencer';
    else if (user.role === 'livetv') roleKey = 'livetv';
    else if (user.role === 'banneragency') roleKey = 'banneragency';

    // Get videos for this role
    const videos = roleKey && platformSettings.trainingVideos ? platformSettings.trainingVideos[roleKey] : [];

    const getYoutubeEmbedUrl = (url: string) => {
        // Extract ID from various YouTube URL formats
        const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
        const match = url.match(regExp);
        const id = (match && match[2].length === 11) ? match[2] : null;
        return id ? `https://www.youtube.com/embed/${id}` : null;
    };

    return (
        <div className="max-w-7xl mx-auto px-4 py-8 pb-20">
            <div className="text-center mb-10">
                <div className="inline-block p-3 bg-indigo-100 dark:bg-indigo-900/30 rounded-full mb-4 text-indigo-600 dark:text-indigo-400">
                    <AcademicCapIcon className="w-10 h-10" />
                </div>
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-2">
                    Training Center
                </h1>
                <p className="text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
                    Master the platform with these curated training videos designed for your role as a {roleKey ? roleKey.charAt(0).toUpperCase() + roleKey.slice(1) : 'user'}.
                </p>
            </div>

            {(!videos || videos.length === 0) ? (
                <div className="text-center py-20 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700">
                    <YoutubeIcon className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                    <p className="text-gray-500 dark:text-gray-400">No training videos available for your role yet.</p>
                    <p className="text-sm text-gray-400 mt-2">Check back soon for updates!</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {videos.map((video, index) => {
                        const embedUrl = getYoutubeEmbedUrl(video.url);
                        
                        return (
                            <div key={video.id || index} className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-100 dark:border-gray-700 hover:shadow-xl transition-shadow duration-300 flex flex-col">
                                <div className="aspect-w-16 aspect-h-9 w-full bg-gray-100 dark:bg-gray-900 relative pt-[56.25%]">
                                    {embedUrl ? (
                                        <iframe
                                            className="absolute top-0 left-0 w-full h-full"
                                            src={embedUrl}
                                            title={video.title}
                                            frameBorder="0"
                                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                            allowFullScreen
                                        ></iframe>
                                    ) : (
                                        <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center text-gray-400 flex-col">
                                            <YoutubeIcon className="w-12 h-12 mb-2" />
                                            <span className="text-xs">Invalid Video URL</span>
                                        </div>
                                    )}
                                </div>
                                <div className="p-5 flex-grow flex flex-col justify-between">
                                    <div>
                                        <h3 className="font-bold text-lg text-gray-900 dark:text-white line-clamp-2 mb-2">
                                            {video.title}
                                        </h3>
                                    </div>
                                    <a 
                                        href={video.url} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="mt-4 inline-flex items-center text-sm font-medium text-indigo-600 hover:text-indigo-800 dark:text-indigo-400 dark:hover:text-indigo-300"
                                    >
                                        <YoutubeIcon className="w-4 h-4 mr-2" />
                                        Watch on YouTube
                                    </a>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default TrainingPage;
