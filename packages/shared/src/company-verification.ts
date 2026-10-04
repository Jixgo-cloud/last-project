// Raw attachments fit within the API's 10 MB JSON limit after base64 encoding.
export const VERIFICATION_MAX_FILES = 5;
export const VERIFICATION_MAX_BYTES = 6 * 1024 * 1024;
export const VERIFICATION_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
