/** Read API body safely when the server returns plain text (e.g. Request Entity Too Large). */
export async function parseApiJsonResponse<T extends { error?: string }>(
  res: Response
): Promise<{ data: T | null; raw: string; parseError: boolean }> {
  const raw = await res.text();
  const trimmed = raw.trim();
  if (!trimmed) {
    return { data: null, raw: "", parseError: false };
  }
  if (
    trimmed.startsWith("{") ||
    trimmed.startsWith("[")
  ) {
    try {
      return {
        data: JSON.parse(trimmed) as T,
        raw,
        parseError: false,
      };
    } catch {
      return { data: null, raw, parseError: true };
    }
  }
  return { data: null, raw, parseError: true };
}

export function apiErrorMessageFromResponse(
  res: Response,
  raw: string,
  parseError: boolean,
  fallback: string
): string {
  if (parseError) {
    const preview = raw.slice(0, 120).replace(/\s+/g, " ");
    if (/request entity too large/i.test(raw)) {
      return (
        "Upload too large for the server. Use fewer or smaller reference images " +
        "(see limits next to the reference count)."
      );
    }
    return preview
      ? `${preview}${raw.length > 120 ? "…" : ""}`
      : `Request failed (${res.status}). ${fallback}`;
  }
  return fallback;
}
