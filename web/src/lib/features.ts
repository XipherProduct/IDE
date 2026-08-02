import {
  Globe,
  Shield,
  Zap,
  ArrowLeftRight,
  MessageSquare,
  History,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface Feature {
  id: string;
  icon: LucideIcon;
  titleKey: string;
  descKey: string;
}

export const features: Feature[] = [
  {
    id: "multi-provider",
    icon: Globe,
    titleKey: "features.multiProvider.title",
    descKey: "features.multiProvider.desc",
  },
  {
    id: "secure-keys",
    icon: Shield,
    titleKey: "features.secureKeys.title",
    descKey: "features.secureKeys.desc",
  },
  {
    id: "streaming",
    icon: Zap,
    titleKey: "features.streaming.title",
    descKey: "features.streaming.desc",
  },
  {
    id: "model-switcher",
    icon: ArrowLeftRight,
    titleKey: "features.modelSwitcher.title",
    descKey: "features.modelSwitcher.desc",
  },
  {
    id: "system-prompt",
    icon: MessageSquare,
    titleKey: "features.systemPrompt.title",
    descKey: "features.systemPrompt.desc",
  },
  {
    id: "history",
    icon: History,
    titleKey: "features.history.title",
    descKey: "features.history.desc",
  },
];
