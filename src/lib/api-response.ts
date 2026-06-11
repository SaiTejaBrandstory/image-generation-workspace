/** Parse a fetch Response body as JSON; surface gateway/timeouts as clear errors. */
export async function readJsonResponse<T extends { error?: string }>(
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
    if (
      res.status === 504 ||
      res.status === 502 ||
      res.status === 503 ||
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

function gatewayErrorMessage(status: number): string {
  if (status === 504 || status === 502 || status === 503) {
    return (
      "Stitching took too long on the server (timeout). " +
      "Try again — if it keeps failing, stitch fewer scenes or retry when the server is less busy."
    );
  }
  return "Server error while stitching. Please try again.";
}
