export function formatUpdatedAgo(timestampMs: number): string {
  const diff = Math.max(0, Date.now() - timestampMs);
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "Updated just now";
  if (minutes < 60) {
    return `Updated ${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `Updated ${hours} hour${hours === 1 ? "" : "s"} ago`;
  }
  const days = Math.floor(hours / 24);
  if (days < 30) {
    return `Updated ${days} day${days === 1 ? "" : "s"} ago`;
  }
  const months = Math.floor(days / 30);
  if (months < 12) {
    return `Updated ${months} month${months === 1 ? "" : "s"} ago`;
  }
  const years = Math.floor(months / 12);
  return `Updated ${years} year${years === 1 ? "" : "s"} ago`;
}
