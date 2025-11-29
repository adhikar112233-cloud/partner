
import { EmiItem, PlatformSettings } from '../types';

export const calculateDurationDays = (startDate: string, endDate: string): number => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    // Add 1 to include both start and end dates
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
};

export const calculateAdPricing = (dailyRate: number, startDate: string, endDate: string, settings: PlatformSettings) => {
    const durationDays = calculateDurationDays(startDate, endDate);
    const baseTotal = dailyRate * durationDays;
    
    // Fees (if applicable to brand)
    const processingFee = settings.isBrandPlatformFeeEnabled 
        ? baseTotal * (settings.paymentProcessingChargeRate / 100) 
        : 0;
    
    // GST on Fees (if applicable to brand) - assuming GST applies to the service + fee or just fee? 
    // Standard model: (Base + Fee) + GST. 
    // BUT the prompt says "total price 140000+gst+other fees".
    // Let's assume GST is applied on the Base + Processing Fee.
    const taxableAmount = baseTotal + processingFee;
    const gstRate = settings.isBrandGstEnabled ? settings.gstRate : 0;
    const gstAmount = taxableAmount * (gstRate / 100);
    
    const finalAmount = taxableAmount + gstAmount;

    return {
        durationDays,
        baseTotal,
        processingFee,
        gstAmount,
        finalAmount
    };
};

export const generateEmiSchedule = (totalAmount: number, startDate: string, endDate: string): EmiItem[] => {
    const durationDays = calculateDurationDays(startDate, endDate);
    
    // Determine number of EMIs. Logic: Every 30 days = 1 chunk.
    // Example: 70 days -> 70/30 = 2.33 -> 3 EMIs.
    const emiCount = Math.ceil(durationDays / 30);
    
    // Create milestones
    const schedule: EmiItem[] = [];
    let remainingAmount = totalAmount;
    
    const start = new Date(startDate);

    for (let i = 0; i < emiCount; i++) {
        // Amount logic:
        // Prompt says: 70 days total.
        // EMI 1 (Day 0): Covers first 30 days.
        // EMI 2 (Day 30): Covers next 30 days.
        // EMI 3 (Day 60): Covers remaining 10 days.
        
        let daysInThisEmi = 30;
        // Check if this is the last one and has fewer days
        if (i === emiCount - 1) {
            daysInThisEmi = durationDays - (i * 30);
        }

        // Calculate proportional amount of the TOTAL (including taxes/fees)
        const emiAmount = Math.floor((totalAmount * daysInThisEmi) / durationDays);
        
        // Adjust last EMI to ensure exact total match due to rounding
        let finalEmiAmount = emiAmount;
        if (i === emiCount - 1) {
            const alreadyAllocated = schedule.reduce((sum, item) => sum + item.amount, 0);
            finalEmiAmount = totalAmount - alreadyAllocated;
        }

        // Calculate Due Date
        const dueDate = new Date(start);
        dueDate.setDate(start.getDate() + (i * 30));

        schedule.push({
            id: `emi_${Date.now()}_${i}`,
            amount: finalEmiAmount,
            dueDate: dueDate.toISOString(),
            status: i === 0 ? 'pending' : 'pending', // First one is pending immediately
            description: `${getOrdinal(i + 1)} EMI (Day ${i * 30 + 1} - ${Math.min((i + 1) * 30, durationDays)})`
        });
    }

    return schedule;
};

const getOrdinal = (n: number) => {
    const s = ["th", "st", "nd", "rd"];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
};
