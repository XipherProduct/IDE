"use client";

import { Hero } from "@/components/sections/hero";
import { TerminalDemo } from "@/components/sections/terminal-demo";
import { FeaturesGrid } from "@/components/sections/features-grid";
import { ProvidersGrid } from "@/components/sections/providers-grid";
import { QuickStartTabs } from "@/components/sections/quick-start-tabs";
import { DownloadGrid } from "@/components/sections/download-grid";
import { WhyXipher } from "@/components/sections/why-xipher";
import { Roadmap } from "@/components/sections/roadmap";
import { CtaFooterBand } from "@/components/sections/cta-footer-band";

export default function HomePage() {
  return (
    <>
      <Hero />
      <TerminalDemo />
      <FeaturesGrid />
      <ProvidersGrid />
      <QuickStartTabs />
      <DownloadGrid />
      <WhyXipher />
      <Roadmap />
      <CtaFooterBand />
    </>
  );
}
