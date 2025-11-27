/**
 * Formats medication names to have consistent capitalization
 * Capitalizes the first letter of each word
 */
export function formatMedicationName(name: string | null | undefined): string {
  if (!name) return '';
  
  return name
    .split(' ')
    .map(word => {
      // Handle special cases like "mg", "ml", etc. (keep lowercase)
      if (word.toLowerCase().match(/^(mg|ml|g|kg|mcg|iu|units?)$/)) {
        return word.toLowerCase();
      }
      // Capitalize first letter, lowercase the rest
      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

/**
 * Formats generic medication names consistently
 */
export function formatGenericName(name: string | null | undefined): string {
  if (!name) return '';
  return formatMedicationName(name);
}

/**
 * Formats dosage text consistently
 */
export function formatDosage(dosage: string | null | undefined): string {
  if (!dosage) return '';
  // Keep dosage as-is but ensure proper spacing
  return dosage.trim();
}

/**
 * Formats frequency text consistently
 */
export function formatFrequency(frequency: string | null | undefined): string {
  if (!frequency) return '';
  // Capitalize first letter
  return frequency.charAt(0).toUpperCase() + frequency.slice(1).toLowerCase();
}


