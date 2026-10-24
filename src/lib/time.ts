/** "just now", "1s ago", "3 min ago", "2 h ago". Negative ages (clock skew) count as now. */
export function formatAge(ageMs: number): string {
  const seconds = Math.max(0, Math.floor(ageMs / 1000));
  if (seconds < 1) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  return `${Math.floor(minutes / 60)} h ago`;
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString();
}
