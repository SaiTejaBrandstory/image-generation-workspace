import { Clapperboard, ImageIcon, Video } from "lucide-react";
import type { MediaType } from "@/types";

export type WorkspaceToolId = MediaType | "storyboard";

export const WORKSPACE_TOOLS: {
  id: WorkspaceToolId;
  label: string;
  icon: typeof ImageIcon;
  href: string;
}[] = [
  { id: "image", label: "Image", icon: ImageIcon, href: "/" },
  { id: "video", label: "Video", icon: Video, href: "/" },
  { id: "storyboard", label: "Storyboard", icon: Clapperboard, href: "/storyboard" },
];

export function isStoryboardTool(id: WorkspaceToolId): id is "storyboard" {
  return id === "storyboard";
}
