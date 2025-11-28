

import React, { useState } from 'react';
import { PlatformSettings, CompanyInfo } from '../types';
import { apiService } from '../services/apiService';
import { BACKEND_URL } from '../services/firebase';

interface SettingsPanelProps {
    onSettingsUpdate: () => void;
}

const SettingRow: React.FC<{ label: string; children: React.ReactNode; helpText?: string }> = ({ label, children, helpText }) => (
    <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-start justify-between border-b dark:border-gray-700">
        <div className="sm:w-1/3 mb-2 sm:mb-0 pr-4">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 block">{label}</label>
            {helpText && <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{helpText}</p>}
        </div>
        <div className="sm:w-2/3">{children}</div>
    </div>
);

// Reusable Toggle Switch Component
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

const SettingsPanel: React.FC<SettingsPanelProps> = ({ onSettingsUpdate }) => {
    const [settings, setSettings] = useState<PlatformSettings | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    React.useEffect(() => {
        apiService.getPlatformSettings().then(data => {
            setSettings(data);
            setIsLoading(false);
        });
    }, []);

    const handleSettingChange = (key: keyof PlatformSettings, value: any) => {
        if (settings) {
            setSettings({ ...settings, [key]: value });
        }
    };

    const handleCompanyInfoChange = (field: keyof CompanyInfo, value: string) => {
        if (settings) {
            setSettings({
                ...settings,
                companyInfo: {
                    name: '',
                    address: '',
                    email: '',
                    phone: '',
                    gstIn: '',
                    ...settings.companyInfo,
                    [field]: value
                }
            });
        }
    };

    const handleSave = async () => {
        if (settings) {
            setIsSaving(true);
            try {
                await apiService.updatePlatformSettings(settings);
                onSettingsUpdate();
                alert("Settings saved successfully!");
            } catch (e) {
                console.error(e);
                alert("Failed to save settings.");
            } finally {
                setIsSaving(false);
            }
        }
    };

    if (isLoading || !settings) return <div className="p-8 text-center dark:text-gray-300">Loading settings...</div>;

    return (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg">
            <div className="px-6 py-4 border-b dark:border-gray-700 flex justify-between items-center sticky top-0 bg-white dark:bg-gray-800 z-10">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Platform Settings</h3>
                <button onClick={handleSave} disabled={isSaving} className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-sm">
                    {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
            </div>
            
            <div className="divide-y divide-gray-200 dark:divide-gray-700 max-h-[calc(100vh-200px)] overflow-y-auto">
                {/* Company Information (New Section) */}
                <div className="px-6 py-3 bg-purple-50 dark:bg-purple-900/20"><h4 className="font-semibold text-purple-800 dark:text-purple-200">Company Information (For Agreements)</h4></div>
                <SettingRow label="Company Name" helpText="The official name of your company displayed in user agreements.">
                    <input type="text" value={settings.companyInfo?.name || ''} onChange={e => handleCompanyInfoChange('name', e.target.value)} className="w-full rounded-md border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                </SettingRow>
                <SettingRow label="Address" helpText="Official registered address.">
                    <textarea value={settings.companyInfo?.address || ''} onChange={e => handleCompanyInfoChange('address', e.target.value)} className="w-full rounded-md border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white" rows={2} />
                </SettingRow>
                <SettingRow label="Contact Email" helpText="Support or legal contact email.">
                    <input type="email" value={settings.companyInfo?.email || ''} onChange={e => handleCompanyInfoChange('email', e.target.value)} className="w-full rounded-md border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                </SettingRow>
                <SettingRow label="Contact Phone" helpText="Support or legal contact phone number.">
                    <input type="text" value={settings.companyInfo?.phone || ''} onChange={e => handleCompanyInfoChange('phone', e.target.value)} className="w-full rounded-md border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                </SettingRow>
                <SettingRow label="GSTIN" helpText="GST Identification Number (Optional).">
                    <input type="text" value={settings.companyInfo?.gstIn || ''} onChange={e => handleCompanyInfoChange('gstIn', e.target.value)} className="w-full rounded-md border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                </SettingRow>

                {/* General */}
                <div className="px-6 py-3 bg-gray-50 dark:bg-gray-700"><h4 className="font-semibold text-gray-600 dark:text-gray-300">General Configuration</h4></div>
                <SettingRow label="Community Feed" helpText="Enable/Disable the public social feed for users.">
                    <div className="flex items-center">
                        <ToggleSwitch enabled={settings.isCommunityFeedEnabled} onChange={val => handleSettingChange('isCommunityFeedEnabled', val)} />
                        <label className="ml-2 text-sm text-gray-700 dark:text-gray-300">Enable Feed</label>
                    </div>
                </SettingRow>
                <SettingRow label="Maintenance Mode" helpText="Restricts access to the platform for non-admin users.">
                    <div className="flex items-center">
                        <ToggleSwitch enabled={settings.isMaintenanceModeEnabled} onChange={val => handleSettingChange('isMaintenanceModeEnabled', val)} />
                        <label className="ml-2 text-sm text-gray-700 dark:text-gray-300">Enable Maintenance</label>
                    </div>
                </SettingRow>
                <SettingRow label="Welcome Message">
                    <textarea value={settings.welcomeMessage || ''} onChange={e => handleSettingChange('welcomeMessage', e.target.value)} className="w-full rounded-md border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white" rows={2} />
                </SettingRow>
                <SettingRow label="Loan & Recharge URL" helpText="Link for the Loan & Recharge icon in the header. If empty, it shows 'Coming Soon'.">
                    <input type="url" value={settings.loanAndRechargeUrl || ''} onChange={e => handleSettingChange('loanAndRechargeUrl', e.target.value)} className="w-full rounded-md border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="https://example.com" />
                </SettingRow>
                <SettingRow label="Shopping Link / Store URL" helpText="Link for the 'Shopping' menu item in the sidebar.">
                    <input type="url" value={settings.shoppingUrl || ''} onChange={e => handleSettingChange('shoppingUrl', e.target.value)} className="w-full rounded-md border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="https://myshop.com" />
                </SettingRow>
                <SettingRow label="YouTube Tutorial Link" helpText="Link for the YouTube tutorial icon in the header.">
                    <input type="url" value={settings.youtubeTutorialUrl || ''} onChange={e => handleSettingChange('youtubeTutorialUrl', e.target.value)} className="w-full rounded-md border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white" placeholder="https://youtube.com/..." />
                </SettingRow>
                
                {/* Authentication */}
                <div className="px-6 py-3 bg-gray-50 dark:bg-gray-700"><h4 className="font-semibold text-gray-600 dark:text-gray-300">Authentication</h4></div>
                <SettingRow label="Google Login" helpText="Allow users to sign up/login using their Google account.">
                    <div className="flex items-center">
                        <ToggleSwitch enabled={settings.isGoogleLoginEnabled} onChange={val => handleSettingChange('isGoogleLoginEnabled', val)} />
                        <label className="ml-2 text-sm text-gray-700 dark:text-gray-300">Enable Google Login</label>
                    </div>
                </SettingRow>

                {/* Financial Controls */}
                <div className="px-6 py-3 bg-blue-50 dark:bg-blue-900/20"><h4 className="font-semibold text-blue-800 dark:text-blue-200">Financial Controls (On/Off)</h4></div>
                
                <SettingRow label="Brand: Platform Fees" helpText="Apply processing charges/platform fees to Brands during payment checkout.">
                     <ToggleSwitch enabled={settings.isBrandPlatformFeeEnabled} onChange={val => handleSettingChange('isBrandPlatformFeeEnabled', val)} />
                </SettingRow>
                <SettingRow label="Brand: GST" helpText="Apply GST on top of fees to Brands during payment checkout.">
                     <ToggleSwitch enabled={settings.isBrandGstEnabled} onChange={val => handleSettingChange('isBrandGstEnabled', val)} />
                </SettingRow>
                
                <SettingRow label="Creator: Platform Fees (Commission)" helpText="Deduct platform commission from Creator payouts.">
                     <ToggleSwitch enabled={settings.isPlatformCommissionEnabled} onChange={val => handleSettingChange('isPlatformCommissionEnabled', val)} />
                </SettingRow>
                <SettingRow label="Creator: GST" helpText="Deduct GST on the commission amount from Creator payouts.">
                     <ToggleSwitch enabled={settings.isCreatorGstEnabled} onChange={val => handleSettingChange('isCreatorGstEnabled', val)} />
                </SettingRow>

                {/* Financial Rates */}
                <div className="px-6 py-3 bg-gray-50 dark:bg-gray-700"><h4 className="font-semibold text-gray-600 dark:text-gray-300">Financial Rates</h4></div>
                <SettingRow label="Platform Commission Rate (%)" helpText="Percentage deducted from creator earnings.">
                    <input type="number" value={settings.platformCommissionRate} onChange={e => handleSettingChange('platformCommissionRate', Number(e.target.value))} className="w-full rounded-md border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                </SettingRow>
                <SettingRow label="Brand Processing Fee Rate (%)" helpText="Percentage added to brand payments.">
                    <input type="number" value={settings.paymentProcessingChargeRate} onChange={e => handleSettingChange('paymentProcessingChargeRate', Number(e.target.value))} className="w-full rounded-md border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                </SettingRow>
                <SettingRow label="GST Rate (%)" helpText="Applicable tax rate.">
                    <input type="number" value={settings.gstRate} onChange={e => handleSettingChange('gstRate', Number(e.target.value))} className="w-full rounded-md border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                </SettingRow>
                <SettingRow label="Cancellation Penalty Amount (₹)" helpText="Amount to be deducted from creator's next payout if they cancel a collaboration.">
                    <input type="number" value={settings.cancellationPenaltyAmount || 0} onChange={e => handleSettingChange('cancellationPenaltyAmount', Number(e.target.value))} className="w-full rounded-md border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                </SettingRow>

                {/* Integration */}
                <div className="px-6 py-3 bg-gray-50 dark:bg-gray-700"><h4 className="font-semibold text-gray-600 dark:text-gray-300">Backend Integration</h4></div>
                <SettingRow label="Backend URL" helpText="The URL of your deployed Firebase Cloud Function.">
                    <div className="flex items-center gap-2">
                        <code className="flex-1 p-2 bg-gray-100 dark:bg-gray-900 rounded border border-gray-200 dark:border-gray-600 text-sm font-mono text-gray-800 dark:text-gray-300 break-all">
                            {BACKEND_URL}
                        </code>
                    </div>
                </SettingRow>

                {/* Payment Keys */}
                <div className="px-6 py-3 bg-gray-50 dark:bg-gray-700"><h4 className="font-semibold text-gray-600 dark:text-gray-300">Payment Gateway (Cashfree PG)</h4></div>
                <SettingRow label="Active Gateway">
                    <select value={settings.activePaymentGateway} onChange={e => handleSettingChange('activePaymentGateway', e.target.value)} className="w-full rounded-md border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                        <option value="cashfree">Cashfree</option>
                    </select>
                </SettingRow>
                <SettingRow label="App ID" helpText="From Cashfree PG Dashboard.">
                    <input type="text" value={settings.paymentGatewayApiId || ''} onChange={e => handleSettingChange('paymentGatewayApiId', e.target.value)} className="w-full rounded-md border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white font-mono text-sm" />
                </SettingRow>
                <SettingRow label="Secret Key" helpText="From Cashfree PG Dashboard.">
                    <input type="password" value={settings.paymentGatewayApiSecret || ''} onChange={e => handleSettingChange('paymentGatewayApiSecret', e.target.value)} className="w-full rounded-md border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white font-mono text-sm" />
                </SettingRow>

                {/* Verification Keys */}
                <div className="px-6 py-3 bg-yellow-50 dark:bg-yellow-900/20"><h4 className="font-semibold text-yellow-800 dark:text-yellow-200">Verification / KYC API (Cashfree Verification)</h4></div>
                <SettingRow label="Verification Client ID" helpText="Required for Instant KYC. Get this from Cashfree Verification Dashboard -> API Keys.">
                    <input type="text" value={settings.cashfreeKycClientId || ''} onChange={e => handleSettingChange('cashfreeKycClientId', e.target.value)} className="w-full rounded-md border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white font-mono text-sm" placeholder="e.g. CF................" />
                </SettingRow>
                <SettingRow label="Verification Client Secret" helpText="Required for Instant KYC. Get this from Cashfree Verification Dashboard -> API Keys.">
                    <input type="password" value={settings.cashfreeKycClientSecret || ''} onChange={e => handleSettingChange('cashfreeKycClientSecret', e.target.value)} className="w-full rounded-md border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white font-mono text-sm" placeholder="e.g. ...................." />
                </SettingRow>

                {/* Payout Keys */}
                <div className="px-6 py-3 bg-gray-50 dark:bg-gray-700"><h4 className="font-semibold text-gray-600 dark:text-gray-300">Payouts (Cashfree Payouts)</h4></div>
                <SettingRow label="Payout Client ID" helpText="From Cashfree Payouts Dashboard.">
                    <input type="text" value={settings.payoutClientId || ''} onChange={e => handleSettingChange('payoutClientId', e.target.value)} className="w-full rounded-md border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white font-mono text-sm" />
                </SettingRow>
                <SettingRow label="Payout Client Secret" helpText="From Cashfree Payouts Dashboard.">
                    <input type="password" value={settings.payoutClientSecret || ''} onChange={e => handleSettingChange('payoutClientSecret', e.target.value)} className="w-full rounded-md border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white font-mono text-sm" />
                </SettingRow>

                {/* KYC Settings */}
                <div className="px-6 py-3 bg-gray-50 dark:bg-gray-700"><h4 className="font-semibold text-gray-600 dark:text-gray-300">KYC & Verification Rules</h4></div>
                <SettingRow label="Enable Instant KYC" helpText="Uses Cashfree API to verify Aadhaar, PAN, DL instantly.">
                    <div className="flex items-center">
                        <ToggleSwitch enabled={settings.isInstantKycEnabled} onChange={val => handleSettingChange('isInstantKycEnabled', val)} />
                    </div>
                </SettingRow>
                <SettingRow label="Require Live Selfie" helpText="For both KYC and Payouts to prevent fraud.">
                    <div className="flex items-center">
                        <ToggleSwitch enabled={settings.isKycSelfieRequired} onChange={val => handleSettingChange('isKycSelfieRequired', val)} />
                    </div>
                </SettingRow>
            </div>
        </div>
    );
};

export default SettingsPanel;
