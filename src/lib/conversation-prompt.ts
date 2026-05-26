import type { Conversation } from "@/types";

/** Latest user prompt for a conversation (not the first message). */
export function latestPromptFromConversation(conversation: Conversation): string {
  const userMessages = conversation.messages.filter((m) => m.role === "user");
  if (userMessages.length > 0) {
    return userMessages[userMessages.length - 1]!.content;
  }

  const variants = conversation.variants ?? [];
  if (variants.length > 0) {
    const sorted = [...variants].sort((a, b) => {
      const roundDiff = (b.generationRound ?? 0) - (a.generationRound ?? 0);
      if (roundDiff !== 0) return roundDiff;
      return (b.createdAt ?? 0) - (a.createdAt ?? 0);
    });
    const latest = sorted[0]!;
    if (latest.userPrompt?.trim()) return latest.userPrompt.trim();
    if (latest.prompt?.trim()) return latest.prompt.trim();
  }

  if (conversation.prompt?.trim()) return conversation.prompt.trim();
  return conversation.title;
}
