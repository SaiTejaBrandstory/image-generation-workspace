export interface StoryboardSamplePrompt {
  id: string;
  label: string;
  prompt: string;
}

export const STORYBOARD_SAMPLE_PROMPTS: StoryboardSamplePrompt[] = [
  {
    id: "running-shoe",
    label: "Running shoe ad",
    prompt:
      "Running shoe commercial. Athlete sprints through rainy city streets at night. Close-ups on shoes hitting wet pavement. Ends on a rooftop at sunrise, energetic and cinematic.",
  },
  {
    id: "saas-explainer",
    label: "SaaS explainer",
    prompt:
      "SaaS product explainer. A marketer is overwhelmed by messy tabs, then discovers a clean dashboard. Team celebrates on a video call. Ends with a confident launch-ready moment.",
  },
  {
    id: "coffee-brand",
    label: "Coffee brand film",
    prompt:
      "Cinematic coffee brand story. Farmer picks cherries at dawn on a misty hillside. Beans roasted in a small roastery. Customer enjoys a warm cup in a cozy café. Warm, documentary feel.",
  },
];
