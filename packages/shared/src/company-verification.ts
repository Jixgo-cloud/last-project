// Base64 of 3 MiB plus metadata fits Vercel's 4.5 MB function payload limit.
export const VERIFICATION_MAX_FILES = 5;
export const VERIFICATION_MAX_BYTES = 3 * 1024 * 1024;
export const VERIFICATION_MIME_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
