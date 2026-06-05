"use client";

import { AnimatePresence, motion } from "framer-motion";
import { useStoryboardStore } from "@/store/storyboard-store";
import { StoryboardStepIndicator } from "./storyboard-step-indicator";
import { StepScriptInput } from "./step-script-input";
import { StepProjectConfig } from "./step-project-config";
import { StepSceneBreakdown } from "./step-scene-breakdown";
import { StepStoryboardViewer } from "./step-storyboard-viewer";

export function StoryboardWizard() {
  const step = useStoryboardStore((s) => s.step);
  const wizardLocked = useStoryboardStore((s) => s.wizardLocked);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <header className="shrink-0 border-b border-border/80 bg-surface-elevated/60 px-4 py-3.5 backdrop-blur-md sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-accent-orange/12 text-[11px] font-bold text-accent-orange ring-1 ring-inset ring-accent-orange/20">
              SB
            </div>
            <p className="text-sm font-semibold tracking-tight">Storyboard Studio</p>
          </div>
          <StoryboardStepIndicator current={step} wizardLocked={wizardLocked} />
        </div>
      </header>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-8 pb-16 sm:px-6">
        <div className="mx-auto h-full max-w-6xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.22, ease: "easeOut" }}
              className="h-full min-h-0"
            >
              {step === 1 && <StepScriptInput />}
              {step === 2 && <StepProjectConfig />}
              {step === 3 && <StepSceneBreakdown />}
              {step === 4 && <StepStoryboardViewer />}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
