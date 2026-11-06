export function buildWhatsAppUrl(phone?: string | null, text?: string): string {
  const cleanPhone = (phone || '').replace(/[^0-9]/g, '');
  const encodedText = text ? encodeURIComponent(text) : '';
  if (cleanPhone) {
    return encodedText ? `https://wa.me/${cleanPhone}?text=${encodedText}` : `https://wa.me/${cleanPhone}`;
  }
  return encodedText ? `https://wa.me/?text=${encodedText}` : `https://wa.me/`;
}
