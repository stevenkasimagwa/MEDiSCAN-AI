export function timeAgo(input?: string | number | null): string {
  if (!input && input !== 0) return '-';
  try {
    let d: Date;
    // Accept numeric timestamps (seconds or milliseconds) or ISO strings
    if (typeof input === 'number') {
      // detect seconds vs ms (epoch seconds ~ 10 digits)
      d = input > 1e12 ? new Date(input) : new Date(input * 1000);
    } else if (/^\d+$/.test(String(input))) {
      const n = Number(input);
      d = n > 1e12 ? new Date(n) : new Date(n * 1000);
    } else {
      d = new Date(String(input));
    }

    if (isNaN(d.getTime())) return String(input);

  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  if (diffMs < 0) return 'just now';
  const seconds = Math.floor(diffMs / 1000);
  if (seconds < 5) return 'just now'; // keep very recent entries readable
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    const weeks = Math.floor(days / 7);
    if (weeks < 5) return `${weeks}w ago`;
    const months = Math.floor(days / 30);
    if (months < 12) return `${months}mo ago`;
    const years = Math.floor(days / 365);
    return `${years}y ago`;
  } catch (e) {
    return String(input);
  }
}
