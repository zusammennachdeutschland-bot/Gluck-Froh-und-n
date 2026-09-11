/**
 * Utility functions for formatting phone numbers and building WhatsApp wa.me links.
 * Supports both traditional phone numbers and WhatsApp usernames (e.g. @username or username).
 */

/**
 * Checks if a contact value is a WhatsApp username rather than a traditional phone number.
 * WhatsApp usernames typically start with '@' or contain alphabetic characters.
 */
export function isWhatsAppUsername(contact?: string | null): boolean {
  if (!contact) return false;
  const trimmed = contact.toString().trim();
  if (trimmed.startsWith('@')) return true;
  // If it contains letters, it's definitely a username
  return /[a-zA-Z]/.test(trimmed);
}

/**
 * Cleans a WhatsApp username by stripping leading '@' and invalid characters.
 */
export function cleanWhatsAppUsername(contact?: string | null): string {
  if (!contact) return '';
  let trimmed = contact.toString().trim();
  if (trimmed.startsWith('@')) {
    trimmed = trimmed.substring(1);
  }
  return trimmed.replace(/[^a-zA-Z0-9._]/g, '');
}

/**
 * Formats a contact (phone or username) for user-friendly display in UI.
 * e.g., "@username" for usernames, or the phone number for phones.
 */
export function formatContactDisplay(contact?: string | null): string {
  if (!contact) return '';
  const trimmed = contact.toString().trim();
  if (isWhatsAppUsername(trimmed)) {
    const clean = cleanWhatsAppUsername(trimmed);
    return clean ? `@${clean}` : trimmed;
  }
  return trimmed;
}

/**
 * Formats phone numbers into a clean international number for WhatsApp wa.me links.
 * If the input is a WhatsApp username, returns the cleaned username.
 * Strips plus signs, dashes, spaces, brackets, leading '00', and adds default country codes
 * for local Egyptian (01x -> 201x) and German (015x/016x/017x -> 491x) numbers if needed.
 * Also handles numbers entered with country code + leading zero (e.g. +20 011... -> 2011...).
 */
export function formatWhatsAppPhone(phone?: string | null): string {
  if (!phone) return '';
  const trimmed = phone.toString().trim();

  // If it's a WhatsApp username, return cleaned username
  if (isWhatsAppUsername(trimmed)) {
    return cleanWhatsAppUsername(trimmed);
  }
  
  // Strip all non-digit characters
  let cleaned = trimmed.replace(/\D/g, '');
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
 * Works seamlessly with both phone numbers and WhatsApp usernames.
 * If phone number / username is invalid or missing, returns a wa.me URL with just the text parameter
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

export interface ResolvedWhatsAppContact {
  contact: string;       // raw or cleaned contact (phone or @username)
  cleanForUrl: string;   // formatted for wa.me URL
  isUsername: boolean;   // true if username
  display: string;       // user-friendly display (e.g. "@username" or formatted phone)
  type: 'parent' | 'student' | 'none';
  hasContact: boolean;   // true if any contact exists
}

/**
 * Resolves the best WhatsApp contact for a student with smart fallback:
 * Parent Phone > Parent Username > Student Phone > Student Username > Quick Fallbacks.
 * Ensures if there is no phone number, it seamlessly uses the username!
 */
export function resolveStudentWhatsAppContact(
  student?: {
    parentPhone?: string | null;
    parentUsername?: string | null;
    parentContactType?: string | null;
    studentPhone?: string | null;
    studentUsername?: string | null;
    studentContactType?: string | null;
  } | null,
  fallback?: {
    quickParentPhone?: string | null;
    quickStudentPhone?: string | null;
    defaultPhone?: string | null;
  }
): ResolvedWhatsAppContact {
  const isMeaningful = (val?: string | null): boolean => {
    if (!val) return false;
    const t = val.trim();
    return t !== '' && t !== '-' && t !== '—' && t.toLowerCase() !== 'null' && t.toLowerCase() !== 'undefined';
  };

  // 1. Check parent phone
  const pPhone = (student?.parentPhone && isMeaningful(student.parentPhone) ? student.parentPhone.trim() : '') ||
    (fallback?.quickParentPhone && isMeaningful(fallback.quickParentPhone) ? fallback.quickParentPhone.trim() : '');
  
  if (pPhone) {
    const isUser = isWhatsAppUsername(pPhone) || student?.parentContactType === 'username';
    const clean = formatWhatsAppPhone(pPhone);
    return {
      contact: pPhone,
      cleanForUrl: clean,
      isUsername: isUser,
      display: formatContactDisplay(pPhone),
      type: 'parent',
      hasContact: !!clean
    };
  }

  // 2. Check parent username directly if parentPhone was empty
  const pUser = student?.parentUsername && isMeaningful(student.parentUsername) ? student.parentUsername.trim() : '';
  if (pUser) {
    const clean = cleanWhatsAppUsername(pUser);
    return {
      contact: `@${clean}`,
      cleanForUrl: clean,
      isUsername: true,
      display: `@${clean}`,
      type: 'parent',
      hasContact: !!clean
    };
  }

  // 3. Check student phone
  const sPhone = (student?.studentPhone && isMeaningful(student.studentPhone) ? student.studentPhone.trim() : '') ||
    (fallback?.quickStudentPhone && isMeaningful(fallback.quickStudentPhone) ? fallback.quickStudentPhone.trim() : '');
  
  if (sPhone) {
    const isUser = isWhatsAppUsername(sPhone) || student?.studentContactType === 'username';
    const clean = formatWhatsAppPhone(sPhone);
    return {
      contact: sPhone,
      cleanForUrl: clean,
      isUsername: isUser,
      display: formatContactDisplay(sPhone),
      type: 'student',
      hasContact: !!clean
    };
  }

  // 4. Check student username
  const sUser = student?.studentUsername && isMeaningful(student.studentUsername) ? student.studentUsername.trim() : '';
  if (sUser) {
    const clean = cleanWhatsAppUsername(sUser);
    return {
      contact: `@${clean}`,
      cleanForUrl: clean,
      isUsername: true,
      display: `@${clean}`,
      type: 'student',
      hasContact: !!clean
    };
  }

  // 5. Default fallback
  const dPhone = fallback?.defaultPhone && isMeaningful(fallback.defaultPhone) ? fallback.defaultPhone.trim() : '';
  if (dPhone) {
    const isUser = isWhatsAppUsername(dPhone);
    const clean = formatWhatsAppPhone(dPhone);
    return {
      contact: dPhone,
      cleanForUrl: clean,
      isUsername: isUser,
      display: formatContactDisplay(dPhone),
      type: 'parent',
      hasContact: !!clean
    };
  }

  return {
    contact: '',
    cleanForUrl: '',
    isUsername: false,
    display: '',
    type: 'none',
    hasContact: false
  };
}

