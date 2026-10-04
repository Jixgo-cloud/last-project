export function getSafeInternalRedirect(path: string | null): string | null {
  if (!path || !path.startsWith('/') || path.startsWith('//') || path.includes('\\')) {
    return null;
  }

  try {
    const resolvedPath = new URL(path, 'https://smartcareer.local');
    return resolvedPath.origin === 'https://smartcareer.local'
      ? `${resolvedPath.pathname}${resolvedPath.search}${resolvedPath.hash}`
      : null;
  } catch {
    return null;
  }
}
