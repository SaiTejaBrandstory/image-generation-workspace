/** Pull a human-readable message from API JSON error fields. */
export function extractApiErrorMessage(
  data: unknown,
  fallback = "Request failed"
): string {
  if (data == null) return fallback;
  if (typeof data === "string") return data.trim() || fallback;
  if (typeof data !== "object") return fallback;

  const record = data as Record<string, unknown>;
  const error = record.error;
  if (typeof error === "string") return error.trim() || fallback;
  if (error && typeof error === "object") {
    const nested = error as Record<string, unknown>;
    if (typeof nested.message === "string") return nested.message;
    if (typeof nested.error === "string") return nested.error;
  }
  if (typeof record.message === "string") return record.message;
  return fallback;
}

/** Parse a fetch Response body as JSON; surface gateway/timeouts as clear errors. */
export async function readJsonResponse<T extends { error?: unknown }>(
  res: Response
): Promise<T> {
  const text = await res.text();
  if (!text.trim()) {
    if (!res.ok) {
      throw new Error(gatewayErrorMessage(res.status));
    }
    return {} as T;
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    const lower = text.toLowerCase();
    const isHtmlErrorPage =
      lower.includes("<!doctype html") ||
      lower.includes("__next_error__") ||
      lower.includes("<html");
    if (
      res.status === 504 ||
      res.status === 502 ||
      res.status === 503 ||
      isHtmlErrorPage ||
      lower.includes("an error occurred") ||
      lower.includes("function_invocation") ||
      lower.includes("gateway timeout")
    ) {
      throw new Error(gatewayErrorMessage(res.status));
    }

    const preview = text.replace(/\s+/g, " ").trim().slice(0, 160);
    throw new Error(
      res.ok
        ? "Invalid response from server."
        : preview || `Request failed (${res.status}).`
    );
  }
}

export function errorMessageFromUnknown(
  err: unknown,
  fallback = "Something went wrong"
): string {
  if (err instanceof Error) return err.message.trim() || fallback;
  if (typeof err === "string") return err.trim() || fallback;
  return extractApiErrorMessage(err, fallback);
}

function gatewayErrorMessage(status: number): string {
  if (status === 504 || status === 502 || status === 503) {
    return (
      "Stitching took too long on the server (timeout). " +
      "Try again — if it keeps failing, stitch fewer scenes or retry when the server is less busy."
    );
  }
  return "Server error while stitching. Please try again.";
}
