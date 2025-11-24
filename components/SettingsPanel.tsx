
import React, { useState, useEffect } from 'react';
import { apiService } from '../services/apiService';
import { PlatformSettings, SocialMediaLink, MembershipPlan, BoostType, User } from '../types';

const ToggleSwitch: React.FC<{ enabled: boolean; onChange: (enabled: boolean) => void }> = ({ enabled, onChange }) => (
    <button
        type="button"
        className={`${
            enabled ? 'bg-indigo-600' : 'bg-gray-200'
        } relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2`}
        role="switch"
        aria-checked={enabled}
        onClick={() => onChange(!enabled)}
    >
        <span
            aria-hidden="true"
            className={`${
                enabled ? 'translate-x-5' : 'translate-x-0'
            } pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out`}
        />
    </button>
);

const SettingsPanel: React.FC<{ onSettingsUpdate: () => void }> = ({ onSettingsUpdate }) => {
    const [settings, setSettings] = useState<PlatformSettings | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [isDirty, setIsDirty] = useState(false);
    const [staffUsers, setStaffUsers] = useState<User[]>([]);

    const [newPlatform, setNewPlatform] = useState('');
    const [newUrl, setNewUrl] = useState('');

    useEffect(() => {
        const loadData = async () => {
            try {
                const [settingsData, allUsers] = await Promise.all([
                    apiService.getPlatformSettings(),
                    apiService.getAllUsers()
                ]);
                setSettings(settingsData);
                setStaffUsers(allUsers.filter(u => u.role === 'staff'));
            } catch {
                setError('Failed to load settings.');
            } finally {
                setIsLoading(false);
            }
        };
        loadData();
    }, []);

     const handleSettingChange = (key: keyof PlatformSettings, value: any) => {
        if (settings) {
            setSettings({ ...settings, [key]: value });
            setIsDirty(true); setSuccess(null); setError(null);
        }
    };

    const handlePriceChange = (plan: MembershipPlan, value: string) => {
        if (settings) {
            const newPrices = { ...settings.membershipPrices, [plan]: Number(value) };
            handleSettingChange('membershipPrices', newPrices);
        }
    };
    
    const handleBoostPriceChange = (plan: BoostType, value: string) => {
        if (settings) {
            const newPrices = { ...settings.boostPrices, [plan]: Number(value) };
            handleSettingChange('boostPrices', newPrices);
        }
    };

    const handlePayoutSettingChange = (key: keyof PlatformSettings['payoutSettings'], value: boolean) => {
        if (settings) {
            const newPayoutSettings = { ...(settings.payoutSettings || {}), [key]: value };
            handleSettingChange('payoutSettings', newPayoutSettings);
        }
    };
    
    const handleSaveChanges = async () => {
        if (!settings || !isDirty) return;
        setIsSaving(true); setError(null); setSuccess(null);
        try {
            // If active gateway changed, use the dedicated API endpoint to ensure immediate backend update
            if (settings.activePaymentGateway) {
                try {
                    await apiService.setPaymentGateway(settings.activePaymentGateway);
                } catch(e) {
                    console.warn("Failed to update gateway via API, falling back to Firestore update only", e);
                }
            }

            await apiService.updatePlatformSettings(settings);
            setSuccess('Settings saved successfully!'); setIsDirty(false);
            onSettingsUpdate();
        } catch (err) {
            setError('Failed to save settings.');
        } finally {
            setIsSaving(false);
        }
    };
    
    const handleAddLink = () => {
        if (newPlatform.trim() && newUrl.trim() && settings) {
            const newLinks = [...(settings.socialMediaLinks || []), { platform: newPlatform, url: newUrl }];
            handleSettingChange('socialMediaLinks', newLinks);
            setNewPlatform('');
            setNewUrl('');
        }
    };
    
    const handleDeleteLink = (index: number) => {
        if (settings) {
            const newLinks = (settings.socialMediaLinks || []).filter((_, i) => i !== index);
            handleSettingChange('socialMediaLinks', newLinks);
        }
    };

    if (isLoading) return <p className="p-6">Loading settings...</p>;
    if (!settings) return <p className="text-red-500 p-6">{error || 'Could not load settings.'}</p>;

    const SettingRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
        <div className="py-4 sm:grid sm:grid-cols-3 sm:gap-4 sm:py-5 sm:px-6">
            <dt className="text-sm font-medium text-gray-500">{label}</dt>
            <dd className="mt-1 flex text-sm text-gray-900 sm:col-span-2 sm:mt-0 items-center">{children}</dd>
        </div>
    );

    return (
        <div className="divide-y divide-gray-200">
            <dl className="sm:divide-y sm:divide-gray-200">
                <div className="px-6 py-3 bg-gray-50"><h4 className="font-semibold text-gray-600">Site Management</h4></div>
                <SettingRow label="Maintenance Mode"><ToggleSwitch enabled={settings.isMaintenanceModeEnabled} onChange={(val) => handleSettingChange('isMaintenanceModeEnabled', val)} /></SettingRow>
                
                <div className="px-6 py-3 bg-gray-50"><h4 className="font-semibold text-gray-600">Feature Management</h4></div>
                <SettingRow label="Enable Community Feed"><ToggleSwitch enabled={settings.isCommunityFeedEnabled} onChange={(val) => handleSettingChange('isCommunityFeedEnabled', val)} /></SettingRow>
                <SettingRow label="Enable Welcome Message"><ToggleSwitch enabled={settings.isWelcomeMessageEnabled} onChange={(val) => handleSettingChange('isWelcomeMessageEnabled', val)} /></SettingRow>
                <SettingRow label="Welcome Message Text"><textarea value={settings.welcomeMessage} onChange={(e) => handleSettingChange('welcomeMessage', e.target.value)} rows={3} className="w-full rounded-md border-gray-300 shadow-sm" /></SettingRow>
                <SettingRow label="YouTube Tutorial URL"><input type="text" value={settings.youtubeTutorialUrl} onChange={(e) => handleSettingChange('youtubeTutorialUrl', e.target.value)} className="w-full rounded-md border-gray-300 shadow-sm" /></SettingRow>

                <div className="px-6 py-3 bg-gray-50"><h4 className="font-semibold text-gray-600">Boost Settings</h4></div>
                <SettingRow label="Enable Profile Boosting"><ToggleSwitch enabled={settings.isProfileBoostingEnabled} onChange={(val) => handleSettingChange('isProfileBoostingEnabled', val)} /></SettingRow>
                <SettingRow label="Enable Campaign Boosting"><ToggleSwitch enabled={settings.isCampaignBoostingEnabled} onChange={(val) => handleSettingChange('isCampaignBoostingEnabled', val)} /></SettingRow>
                <div className="px-6 py-3 bg-gray-100"><h5 className="font-medium text-gray-500">Boost Prices (INR)</h5></div>
                <SettingRow label="Profile Boost"><input type="number" value={settings.boostPrices.profile} onChange={(e) => handleBoostPriceChange('profile', e.target.value)} className="w-full rounded-md border-gray-300 shadow-sm" /></SettingRow>
                <SettingRow label="Campaign Boost"><input type="number" value={settings.boostPrices.campaign} onChange={(e) => handleBoostPriceChange('campaign', e.target.value)} className="w-full rounded-md border-gray-300 shadow-sm" /></SettingRow>
                <SettingRow label="Banner Ad Boost"><input type="number" value={settings.boostPrices.banner} onChange={(e) => handleBoostPriceChange('banner', e.target.value)} className="w-full rounded-md border-gray-300 shadow-sm" /></SettingRow>

                <div className="px-6 py-3 bg-gray-50"><h4 className="font-semibold text-gray-600">Membership Settings</h4></div>
                <SettingRow label="Enable Brand (Pro) Membership">
                    <ToggleSwitch enabled={settings.isProMembershipEnabled} onChange={(val) => handleSettingChange('isProMembershipEnabled', val)} />
                </SettingRow>
                <SettingRow label="Enable Creator Membership">
                    <ToggleSwitch enabled={settings.isCreatorMembershipEnabled} onChange={(val) => handleSettingChange('isCreatorMembershipEnabled', val)} />
                </SettingRow>

                <div className="px-6 py-3 bg-gray-100"><h5 className="font-medium text-gray-500">Brand Membership Prices (INR)</h5></div>
                <SettingRow label="Pro 10 Plan">
                    <input type="number" value={settings.membershipPrices.pro_10} onChange={(e) => handlePriceChange('pro_10', e.target.value)} className="w-full rounded-md border-gray-300 shadow-sm" />
                </SettingRow>
                <SettingRow label="Pro 20 Plan">
                    <input type="number" value={settings.membershipPrices.pro_20} onChange={(e) => handlePriceChange('pro_20', e.target.value)} className="w-full rounded-md border-gray-300 shadow-sm" />
                </SettingRow>
                <SettingRow label="Pro Unlimited Plan">
                    <input type="number" value={settings.membershipPrices.pro_unlimited} onChange={(e) => handlePriceChange('pro_unlimited', e.target.value)} className="w-full rounded-md border-gray-300 shadow-sm" />
                </SettingRow>

                <div className="px-6 py-3 bg-gray-100"><h5 className="font-medium text-gray-500">Creator Membership Prices (INR)</h5></div>
                <SettingRow label="Basic Plan (1 Month)">
                    <input type="number" value={settings.membershipPrices.basic} onChange={(e) => handlePriceChange('basic', e.target.value)} className="w-full rounded-md border-gray-300 shadow-sm" />
                </SettingRow>
                <SettingRow label="Pro Plan (6 Months)">
                    <input type="number" value={settings.membershipPrices.pro} onChange={(e) => handlePriceChange('pro', e.target.value)} className="w-full rounded-md border-gray-300 shadow-sm" />
                </SettingRow>
                <SettingRow label="Premium Plan (1 Year)">
                    <input type="number" value={settings.membershipPrices.premium} onChange={(e) => handlePriceChange('premium', e.target.value)} className="w-full rounded-md border-gray-300 shadow-sm" />
                </SettingRow>
                
                <div className="px-6 py-3 bg-gray-50"><h4 className="font-semibold text-gray-600">Payout Verification</h4></div>
                <SettingRow label="Require Live Video for Daily Payout">
                    <ToggleSwitch 
                        enabled={settings.payoutSettings?.requireLiveVideoForDailyPayout ?? true} 
                        onChange={(val) => handlePayoutSettingChange('requireLiveVideoForDailyPayout', val)} 
                    />
                </SettingRow>
                <SettingRow label="Require Selfie for Final Payout">
                    <ToggleSwitch 
                        enabled={settings.payoutSettings?.requireSelfieForPayout ?? true} 
                        onChange={(val) => handlePayoutSettingChange('requireSelfieForPayout', val)} 
                    />
                </SettingRow>
                
                <div className="px-6 py-3 bg-gray-50"><h4 className="font-semibold text-gray-600">Live Help Settings</h4></div>
                <SettingRow label="Enable Live Help System">
                    <ToggleSwitch
                        enabled={settings.isLiveHelpEnabled}
                        onChange={(val) => handleSettingChange('isLiveHelpEnabled', val)}
                    />
                </SettingRow>

                <div className="px-6 py-3 bg-gray-50"><h4 className="font-semibold text-gray-600">Authentication</h4></div>
                <SettingRow label="Enable OTP Login"><ToggleSwitch enabled={settings.isOtpLoginEnabled} onChange={(val) => handleSettingChange('isOtpLoginEnabled', val)} /></SettingRow>
                <SettingRow label="Enable 'Forgot Password' via OTP"><ToggleSwitch enabled={settings.isForgotPasswordOtpEnabled} onChange={(val) => handleSettingChange('isForgotPasswordOtpEnabled', val)} /></SettingRow>
                <SettingRow label="Enable Staff Registration from Login Page">
                    <ToggleSwitch enabled={settings.isStaffRegistrationEnabled} onChange={(val) => handleSettingChange('isStaffRegistrationEnabled', val)} />
                </SettingRow>
                
                <div className="px-6 py-3 bg-gray-50"><h4 className="font-semibold text-gray-600">Fees & Commissions</h4></div>
                <SettingRow label="Platform Commission Rate (%)">
                    <div className="flex items-center gap-4 w-full">
                        <ToggleSwitch enabled={settings.isPlatformCommissionEnabled} onChange={(val) => handleSettingChange('isPlatformCommissionEnabled', val)} />
                        <input type="number" value={settings.platformCommissionRate} onChange={(e) => handleSettingChange('platformCommissionRate', Number(e.target.value))} className="w-full rounded-md border-gray-300 shadow-sm" />
                    </div>
                </SettingRow>
                 <SettingRow label="Payment Processing Charge Rate (%)">
                    <div className="flex items-center gap-4 w-full">
                        <ToggleSwitch enabled={settings.isPaymentProcessingChargeEnabled} onChange={(val) => handleSettingChange('isPaymentProcessingChargeEnabled', val)} />
                        <input type="number" value={settings.paymentProcessingChargeRate} onChange={(e) => handleSettingChange('paymentProcessingChargeRate', Number(e.target.value))} className="w-full rounded-md border-gray-300 shadow-sm" />
                    </div>
                </SettingRow>
                <SettingRow label="GST Rate (%)">
                    <div className="flex items-center gap-4 w-full">
                        <ToggleSwitch enabled={settings.isGstEnabled} onChange={(val) => handleSettingChange('isGstEnabled', val)} />
                        <input type="number" value={settings.gstRate} onChange={(e) => handleSettingChange('gstRate', Number(e.target.value))} className="w-full rounded-md border-gray-300 shadow-sm" />
                    </div>
                </SettingRow>

                <div className="px-6 py-3 bg-gray-50"><h4 className="font-semibold text-gray-600">Payment Gateway</h4></div>
                <SettingRow label="Active Gateway (Admin Mode)">
                    <select 
                        value={settings.activePaymentGateway || 'paytm'} 
                        onChange={(e) => handleSettingChange('activePaymentGateway', e.target.value)} 
                        className="w-full rounded-md border-gray-300 shadow-sm focus:ring-indigo-500 focus:border-indigo-500"
                    >
                        <option value="paytm">Paytm</option>
                        <option value="cashfree">Cashfree</option>
                    </select>
                </SettingRow>
                
                {settings.activePaymentGateway === 'paytm' && (
                    <>
                        <SettingRow label="Paytm Merchant ID (MID)">
                            <input 
                                type="text" 
                                value={settings.paytmMid || ''} 
                                onChange={(e) => handleSettingChange('paytmMid', e.target.value)} 
                                className="w-full rounded-md border-gray-300 shadow-sm"
                                placeholder="Enter your Paytm MID" 
                            />
                        </SettingRow>
                        <SettingRow label="Paytm Merchant Key">
                            <input 
                                type="password" 
                                value={settings.paytmMerchantKey || ''} 
                                onChange={(e) => handleSettingChange('paytmMerchantKey', e.target.value)} 
                                className="w-full rounded-md border-gray-300 shadow-sm"
                                placeholder="Enter your Paytm Merchant Key"
                            />
                        </SettingRow>
                    </>
                )}

                {settings.activePaymentGateway === 'cashfree' && (
                    <>
                        <SettingRow label="Cashfree App ID">
                            <input 
                                type="text" 
                                value={settings.paymentGatewayApiId || ''} 
                                onChange={(e) => handleSettingChange('paymentGatewayApiId', e.target.value)} 
                                className="w-full rounded-md border-gray-300 shadow-sm"
                            />
                        </SettingRow>
                        <SettingRow label="Cashfree Secret Key">
                            <input 
                                type="password" 
                                value={settings.paymentGatewayApiSecret || ''} 
                                onChange={(e) => handleSettingChange('paymentGatewayApiSecret', e.target.value)} 
                                className="w-full rounded-md border-gray-300 shadow-sm"
                            />
                        </SettingRow>
                    </>
                )}
                
                <div className="px-6 py-3 bg-gray-50"><h4 className="font-semibold text-gray-600">Manual KYC Settings</h4></div>
                <SettingRow label="Require ID Proof Upload"><ToggleSwitch enabled={settings.isKycIdProofRequired} onChange={(val) => handleSettingChange('isKycIdProofRequired', val)} /></SettingRow>
                <SettingRow label="Require Live Selfie"><ToggleSwitch enabled={settings.isKycSelfieRequired} onChange={(val) => handleSettingChange('isKycSelfieRequired', val)} /></SettingRow>

                <div className="px-6 py-3 bg-gray-50"><h4 className="font-semibold text-gray-600">DigiLocker KYC</h4></div>
                <SettingRow label="Enable DigiLocker KYC"><ToggleSwitch enabled={settings.isDigilockerKycEnabled} onChange={(val) => handleSettingChange('isDigilockerKycEnabled', val)} /></SettingRow>

                 <div className="px-6 py-3 bg-gray-50"><h4 className="font-semibold text-gray-600">Marketing</h4></div>
                 <SettingRow label="Enable Notification Banner"><ToggleSwitch enabled={settings.isNotificationBannerEnabled} onChange={(val) => handleSettingChange('isNotificationBannerEnabled', val)} /></SettingRow>
                 <SettingRow label="Banner Text">
                    <input type="text" value={settings.notificationBannerText} onChange={(e) => handleSettingChange('notificationBannerText', e.target.value)} className="w-full rounded-md border-gray-300 shadow-sm" />
                 </SettingRow>

                 <div className="px-6 py-3 bg-gray-50"><h4 className="font-semibold text-gray-600">Social Media FAB</h4></div>
                 <SettingRow label="Enable Social Media Button">
                    <ToggleSwitch enabled={settings.isSocialMediaFabEnabled} onChange={(val) => handleSettingChange('isSocialMediaFabEnabled', val)} />
                 </SettingRow>
                 <SettingRow label="Social Media Links">
                    <div className="w-full">
                        <div className="space-y-2">
                            {(settings.socialMediaLinks || []).map((link, index) => (
                                <div key={index} className="flex items-center gap-2 p-2 bg-gray-100 rounded">
                                    <span className="font-mono text-xs font-bold w-24 truncate">{link.platform}</span>
                                    <input
                                        type="text"
                                        value={link.url}
                                        onChange={(e) => {
                                            const newLinks = [...settings.socialMediaLinks];
                                            newLinks[index].url = e.target.value;
                                            handleSettingChange('socialMediaLinks', newLinks);
                                        }}
                                        className="flex-1 rounded-md border-gray-300 shadow-sm text-sm"
                                    />
                                    <button type="button" onClick={() => handleDeleteLink(index)} className="text-red-500 font-bold p-1">&times;</button>
                                </div>
                            ))}
                        </div>
                        <div className="mt-4 flex items-center gap-2 border-t pt-4">
                            <input
                                type="text"
                                placeholder="Platform (e.g., Facebook)"
                                value={newPlatform}
                                onChange={(e) => setNewPlatform(e.target.value)}
                                className="w-1/3 rounded-md border-gray-300 shadow-sm text-sm"
                            />
                            <input
                                type="text"
                                placeholder="Full URL"
                                value={newUrl}
                                onChange={(e) => setNewUrl(e.target.value)}
                                className="flex-1 rounded-md border-gray-300 shadow-sm text-sm"
                            />
                            <button type="button" onClick={handleAddLink} className="px-3 py-2 text-sm bg-indigo-100 text-indigo-700 rounded-md">Add</button>
                        </div>
                    </div>
                </SettingRow>

            </dl>
             <div className="bg-gray-50 px-4 py-4 sm:px-6 flex justify-between items-center">
                <div>
                     {success && <p className="text-sm text-green-600">{success}</p>}
                     {error && <p className="text-sm text-red-600">{error}</p>}
                </div>
                <button
                    type="button" onClick={handleSaveChanges} disabled={!isDirty || isSaving}
                    className="inline-flex justify-center rounded-md border border-transparent bg-indigo-600 py-2 px-4 text-sm font-medium text-white shadow-sm hover:bg-indigo-700 disabled:opacity-50"
                >
                    {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
            </div>
        </div>
    );
};

export default SettingsPanel;
