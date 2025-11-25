import React, { useState } from 'react';
import { PlatformSettings } from '../types';
import { apiService } from '../services/apiService';

interface SettingsPanelProps {
    onSettingsUpdate: () => void;
}

const SettingRow: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
    <div className="px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between border-b dark:border-gray-700">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 sm:mb-0 sm:w-1/3">{label}</label>
        <div className="sm:w-2/3">{children}</div>
    </div>
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

    const handleNestedChange = (parent: keyof PlatformSettings, key: string, value: any) => {
        if (settings) {
            setSettings({
                ...settings,
                [parent]: {
                    ...(settings[parent] as any),
                    [key]: value
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
            <div className="px-6 py-4 border-b dark:border-gray-700 flex justify-between items-center">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Platform Settings</h3>
                <button onClick={handleSave} disabled={isSaving} className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50">
                    {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
            </div>
            
            <div className="divide-y divide-gray-200 dark:divide-gray-700">
                <div className="px-6 py-3 bg-gray-50 dark:bg-gray-700"><h4 className="font-semibold text-gray-600 dark:text-gray-300">General</h4></div>
                <SettingRow label="Enable Community Feed">
                    <input type="checkbox" checked={settings.isCommunityFeedEnabled} onChange={e => handleSettingChange('isCommunityFeedEnabled', e.target.checked)} />
                </SettingRow>
                <SettingRow label="Enable Maintenance Mode">
                    <input type="checkbox" checked={settings.isMaintenanceModeEnabled} onChange={e => handleSettingChange('isMaintenanceModeEnabled', e.target.checked)} />
                </SettingRow>
                <SettingRow label="Enable Welcome Message">
                    <input type="checkbox" checked={settings.isWelcomeMessageEnabled} onChange={e => handleSettingChange('isWelcomeMessageEnabled', e.target.checked)} />
                </SettingRow>
                <SettingRow label="Welcome Message Text">
                    <textarea value={settings.welcomeMessage || ''} onChange={e => handleSettingChange('welcomeMessage', e.target.value)} className="w-full rounded-md border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white" rows={3} />
                </SettingRow>
                
                <div className="px-6 py-3 bg-gray-50 dark:bg-gray-700"><h4 className="font-semibold text-gray-600 dark:text-gray-300">Payment Gateway (Cashfree)</h4></div>
                <SettingRow label="Active Gateway">
                    <select value={settings.activePaymentGateway} onChange={e => handleSettingChange('activePaymentGateway', e.target.value)} className="w-full rounded-md border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white">
                        <option value="cashfree">Cashfree</option>
                    </select>
                </SettingRow>
                <SettingRow label="Cashfree App ID">
                    <input type="text" value={settings.paymentGatewayApiId || ''} onChange={e => handleSettingChange('paymentGatewayApiId', e.target.value)} className="w-full rounded-md border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                </SettingRow>
                <SettingRow label="Cashfree Secret Key">
                    <input type="password" value={settings.paymentGatewayApiSecret || ''} onChange={e => handleSettingChange('paymentGatewayApiSecret', e.target.value)} className="w-full rounded-md border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                </SettingRow>

                <div className="px-6 py-3 bg-gray-50 dark:bg-gray-700"><h4 className="font-semibold text-gray-600 dark:text-gray-300">Fees & Commissions</h4></div>
                <SettingRow label="Enable Platform Commission">
                    <input type="checkbox" checked={settings.isPlatformCommissionEnabled} onChange={e => handleSettingChange('isPlatformCommissionEnabled', e.target.checked)} />
                </SettingRow>
                <SettingRow label="Platform Commission (%)">
                    <input type="number" value={settings.platformCommissionRate} onChange={e => handleSettingChange('platformCommissionRate', Number(e.target.value))} className="w-full rounded-md border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                </SettingRow>
                <SettingRow label="Enable GST">
                    <input type="checkbox" checked={settings.isGstEnabled} onChange={e => handleSettingChange('isGstEnabled', e.target.checked)} />
                </SettingRow>
                <SettingRow label="GST Rate (%)">
                    <input type="number" value={settings.gstRate} onChange={e => handleSettingChange('gstRate', Number(e.target.value))} className="w-full rounded-md border-gray-300 dark:bg-gray-700 dark:border-gray-600 dark:text-white" />
                </SettingRow>

                <div className="px-6 py-3 bg-gray-50 dark:bg-gray-700"><h4 className="font-semibold text-gray-600 dark:text-gray-300">Verification & KYC</h4></div>
                <SettingRow label="Require ID Proof for KYC">
                    <input type="checkbox" checked={settings.isKycIdProofRequired} onChange={e => handleSettingChange('isKycIdProofRequired', e.target.checked)} />
                </SettingRow>
                <SettingRow label="Require Live Selfie for KYC">
                    <input type="checkbox" checked={settings.isKycSelfieRequired} onChange={e => handleSettingChange('isKycSelfieRequired', e.target.checked)} />
                </SettingRow>
                <SettingRow label="Enable DigiLocker KYC">
                    <input type="checkbox" checked={settings.isDigilockerKycEnabled} onChange={e => handleSettingChange('isDigilockerKycEnabled', e.target.checked)} />
                </SettingRow>
                <SettingRow label="Require Selfie for Payouts">
                    <input type="checkbox" checked={settings.payoutSettings.requireSelfieForPayout} onChange={e => handleNestedChange('payoutSettings', 'requireSelfieForPayout', e.target.checked)} />
                </SettingRow>
            </div>
        </div>
    );
};

export default SettingsPanel;