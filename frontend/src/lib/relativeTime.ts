/** Relative timestamps with second precision; ticks every minute on the client. */

export function formatRelativeTime(iso: string, short = false): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  if (diffMs < 0) return short ? "now" : "just now";

  const secs = Math.floor(diffMs / 1000);
  if (secs < 60) {
    if (secs < 8) return short ? "now" : "just now";
    return short ? `${secs}s` : `${secs}s ago`;
  }

  const mins = Math.floor(secs / 60);
  if (mins < 60) return short ? `${mins}m` : `${mins}m ago`;

  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return short ? `${hrs}h` : `${hrs}h ago`;

  const days = Math.floor(hrs / 24);
  return short ? `${days}d` : `${days}d ago`;
}
