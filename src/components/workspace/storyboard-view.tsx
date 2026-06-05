"use client";

import { useEffect } from "react";
import { StoryboardWizard } from "@/components/storyboard/storyboard-wizard";
import { useStoryboardStore } from "@/store/storyboard-store";

export function StoryboardView() {
  const loadDraft = useStoryboardStore((s) => s.loadDraft);

  const conversationId = useStoryboardStore((s) => s.conversationId);
  const wizardLocked = useStoryboardStore((s) => s.wizardLocked);

  useEffect(() => {
    if (!conversationId && !wizardLocked) {
      loadDraft();
    }
  }, [loadDraft, conversationId, wizardLocked]);

  return (
    <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-background">
      <StoryboardWizard />
    </main>
  );
}
