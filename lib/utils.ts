// lib/utils.ts
// Utility functions for the sync_leases-ts project

/**
 * Cleans a phone number by removing non-digit characters and limiting to 15 characters
 * @param s The phone number string to clean
 * @returns The cleaned phone number string
 */
/**
 * Cleans a phone number by removing non-digit characters and limiting to 15 characters
 * @param s The phone number string to clean
 * @returns The cleaned phone number string
 */
export const cleanPhone = (s?: string): string => {
  if (!s) return "";
  return s.replace(/\D/g, "").slice(0, 15);
};

/**
 * Formats a phone number to E.164 format (+1XXXXXXXXXX for US numbers)
 * @param s The phone number string to format
 * @returns The formatted phone number in E.164 format
 */
export const formatPhoneE164 = (s?: string): string => {
  if (!s) return "";
  
  // First clean the phone number
  const digitsOnly = cleanPhone(s);
  
  // For US numbers, ensure they have the country code
  if (digitsOnly.length === 10) {
    // Add US country code for 10-digit numbers
    return "+1" + digitsOnly;
  } else if (digitsOnly.length === 11 && digitsOnly.startsWith("1")) {
    // Already has US country code
    return "+" + digitsOnly;
  }
  
  // Return with + prefix for other cases (international or incomplete numbers)
  return digitsOnly.length > 0 ? "+" + digitsOnly : "";
};

/**
 * Maps custom fields from object format to array format
 * @param customFields Object with custom field IDs as keys and values
 * @returns Array of objects with id and value properties
 */
export function mapCustomFields(customFields: Record<string, any> | null | undefined): Array<{id: string, value: any}> {
  console.log("🔥 NEW mapper hit - converting customFields from object to array");
  return Object.entries(customFields || {}).map(([id, value]) => ({ id, value }));
}

/**
 * Calculates yearly rent totals and total lifetime rent
 * @param rent The rent amount for the current booking
 * @param year The year of the booking (YYYY format)
 * @param existingTotals Optional existing yearly totals object
 * @returns Object containing updated yearly totals and total lifetime rent
 */
export function calculateRentTotals(
  rent: number, 
  year: string, 
  existingTotals: Record<string, number> = {}
): { 
  yearlyTotals: Record<string, number>, 
  totalLifetimeRent: number 
} {
  // Create a copy of the existing totals to avoid mutation
  const totals = { ...existingTotals };
  
  // Add the current rent to the year's total
  totals[year] = (totals[year] ?? 0) + rent;
  
  // Calculate the total lifetime rent
  const totalLifetimeRent = Object.values(totals).reduce((a, b) => a + Number(b), 0);
  
  return {
    yearlyTotals: totals,
    totalLifetimeRent
  };
}