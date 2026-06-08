import { formatOpenRouterErrorForUser } from "@/lib/openrouter-errors";
import { getStoryboardTextModels } from "@/lib/storyboard/text-model";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

export async function storyboardChatCompletion(options: {
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  responseFormat?: { type: "json_object" };
}): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("AI is not configured.");
  }

  const models = getStoryboardTextModels();
  let lastError = "No text model available.";

  for (const model of models) {
    const res = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
        "X-Title": "Brandwise Storyboard",
      },
      body: JSON.stringify({
        model,
        messages: options.messages,
        ...(options.responseFormat ? { response_format: options.responseFormat } : {}),
      }),
    });

    if (res.ok) {
      const data = (await res.json()) as {
        choices?: Array<{ message?: { content?: string } }>;
      };
      const content = data.choices?.[0]?.message?.content?.trim();
      if (content) return content;
      lastError = "Model returned an empty response.";
      continue;
    }

    const errText = await res.text();
    lastError = formatOpenRouterErrorForUser(errText);
    const modelUnavailable =
      res.status === 404 ||
      errText.includes("No endpoints found") ||
      errText.includes("not found");
    if (!modelUnavailable) {
      throw new Error(lastError);
    }
  }

  throw new Error(lastError);
}
