/**
 * Utility functions for formatting phone numbers and building WhatsApp wa.me links.
 */

/**
 * Formats phone numbers into a clean international number for WhatsApp wa.me links.
 * Strips plus signs, dashes, spaces, brackets, leading '00', and adds default country codes
 * for local Egyptian (01x -> 201x) and German (015x/016x/017x -> 491x) numbers if needed.
 * Also handles numbers entered with country code + leading zero (e.g. +20 011... -> 2011...).
 */
export function formatWhatsAppPhone(phone?: string | null): string {
  if (!phone) return '';
  
  // Strip all non-digit characters
  let cleaned = phone.toString().trim().replace(/\D/g, '');
  if (!cleaned) return '';

  // Remove leading '00'
  if (cleaned.startsWith('00')) {
    cleaned = cleaned.substring(2);
  }

  // Fix country code + redundant zero, e.g. +20 011... -> 20011... -> 2011...
  if (/^2001[0125]/.test(cleaned)) {
    cleaned = '20' + cleaned.substring(3);
  }

  // Fix German country code + redundant zero, e.g. +49 017... -> 49017... -> 4917...
  if (/^4901[567]/.test(cleaned)) {
    cleaned = '49' + cleaned.substring(3);
  }

  // Handle local numbers starting with a single '0'
  if (cleaned.startsWith('0')) {
    // Egyptian mobile numbers: 11 digits starting with 010, 011, 012, 015
    if (/^01[0125][0-9]{8}$/.test(cleaned)) {
      cleaned = '2' + cleaned; // e.g. 01120980854 -> 201120980854
    } 
    // German mobile numbers: e.g. 015x, 016x, 017x (usually 11-12 digits)
    else if (/^01[567][0-9]{8,9}$/.test(cleaned)) {
      cleaned = '49' + cleaned.substring(1); // e.g. 01701234567 -> 491701234567
    } 
    // General Egyptian 01 mobile numbers if 11 digits
    else if (cleaned.startsWith('01') && cleaned.length === 11) {
      cleaned = '2' + cleaned;
    }
    // Any other number starting with 0, strip leading zero
    else {
      cleaned = cleaned.substring(1);
    }
  }
  // Handle Egyptian numbers entered without leading 0 and without country code (10 digits starting with 10, 11, 12, 15)
  else if (/^1[0125][0-9]{8}$/.test(cleaned)) {
    cleaned = '20' + cleaned; // e.g. 1120980854 -> 201120980854
  }

  return cleaned;
}

/**
 * Builds a valid wa.me WhatsApp URL with encoded message text.
 * If phone number is invalid or missing, returns a wa.me URL with just the text parameter
 * so WhatsApp allows choosing a contact manually.
 */
export function buildWhatsAppUrl(phone?: string | null, text?: string): string {
  const formattedPhone = formatWhatsAppPhone(phone);
  const encodedText = text ? encodeURIComponent(text) : '';
  
  if (formattedPhone) {
    return encodedText 
      ? `https://wa.me/${formattedPhone}?text=${encodedText}`
      : `https://wa.me/${formattedPhone}`;
  }
  
  return encodedText 
    ? `https://wa.me/?text=${encodedText}`
    : `https://wa.me/`;
}

