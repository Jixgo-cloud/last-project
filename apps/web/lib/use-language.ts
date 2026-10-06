'use client';
import { useSyncExternalStore } from 'react';
import type { DisplayLanguage } from './application-status';
const storageKey = 'smartcareer-language-v1';
const changeEvent = 'smartcareer-language-changed';
let fallbackLanguage: DisplayLanguage = 'TH';
function readLanguage(): DisplayLanguage {
  if (typeof window === 'undefined') return 'TH';
  try { return window.localStorage.getItem(storageKey) === 'EN' ? 'EN' : 'TH'; }
  catch { return fallbackLanguage; }
}
function subscribe(listener: () => void) {
  window.addEventListener(changeEvent, listener);
  window.addEventListener('storage', listener);
  return () => {
    window.removeEventListener(changeEvent, listener);
    window.removeEventListener('storage', listener);
  };
}
export function setLanguage(language: DisplayLanguage) {
  fallbackLanguage = language;
  try { window.localStorage.setItem(storageKey, language); } catch { /* Retain the in-memory choice when storage is unavailable. */ }
  window.dispatchEvent(new Event(changeEvent));
}
/** Share the selected language across menus, status chips and route changes. */
export function useLanguage() {
  const language = useSyncExternalStore(subscribe, readLanguage, () => 'TH' as DisplayLanguage);
  return { language, setLanguage };
}
