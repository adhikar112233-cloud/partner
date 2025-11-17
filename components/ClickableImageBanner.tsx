import React from 'react';

interface ClickableImageBannerProps {
    imageUrl: string;
    targetUrl: string;
    title: string;
}

const ClickableImageBanner: React.FC<ClickableImageBannerProps> = ({ imageUrl, targetUrl, title }) => {
    return (
        <div className="bg-gray-200 dark:bg-gray-800 p-2">
            <a href={targetUrl} target="_blank" rel="noopener noreferrer" title={title}>
                <img src={imageUrl} alt={title} className="w-full h-auto object-contain max-h-24" />
            </a>
        </div>
    );
};

export default ClickableImageBanner;