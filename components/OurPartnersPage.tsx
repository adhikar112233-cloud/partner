import React, { useState, useEffect } from 'react';
import { Partner } from '../types';
import { apiService } from '../services/apiService';

const OurPartnersPage: React.FC = () => {
    const [partners, setPartners] = useState<Partner[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const fetchPartners = async () => {
            setIsLoading(true);
            try {
                const partnersData = await apiService.getPartners();
                setPartners(partnersData);
            } catch (err) {
                setError('Failed to load our partners. Please try again later.');
                console.error(err);
            } finally {
                setIsLoading(false);
            }
        };
        fetchPartners();
    }, []);

    return (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center py-12">
                <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white sm:text-5xl md:text-6xl">
                    Our Valued Partners
                </h1>
                <p className="mt-4 max-w-2xl mx-auto text-xl text-gray-500 dark:text-gray-400">
                    We are proud to collaborate with leading brands across various industries.
                </p>
            </div>

            {isLoading && (
                <div className="text-center">
                    <div className="w-8 h-8 border-4 border-dashed rounded-full animate-spin border-indigo-500 mx-auto"></div>
                    <p className="mt-2 text-gray-500 dark:text-gray-400">Loading partners...</p>
                </div>
            )}

            {error && (
                <div className="text-center bg-red-100 text-red-700 p-4 rounded-lg">
                    <p>{error}</p>
                </div>
            )}

            {!isLoading && !error && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-8">
                    {partners.map(partner => (
                        <div key={partner.id} className="flex flex-col items-center justify-center p-6 bg-white dark:bg-gray-800 rounded-2xl shadow-lg transform hover:scale-105 transition-transform duration-300">
                            <div className="h-24 w-full flex items-center justify-center">
                                <img
                                    src={partner.logoUrl}
                                    alt={partner.name}
                                    className="max-h-full max-w-full object-contain"
                                />
                            </div>
                            <p className="mt-4 text-sm font-semibold text-gray-700 dark:text-gray-300 text-center">
                                {partner.name}
                            </p>
                        </div>
                    ))}
                </div>
            )}
             {!isLoading && !error && partners.length === 0 && (
                 <div className="text-center py-10 col-span-full bg-white dark:bg-gray-800 rounded-lg shadow"><p className="text-gray-500 dark:text-gray-400">Our partners list is currently being updated. Check back soon!</p></div>
            )}
        </div>
    );
};

export default OurPartnersPage;
