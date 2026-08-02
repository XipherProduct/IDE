"use client";

import { useTranslations } from "next-intl";
import Link from "next/link";
import { ArrowRight, Github } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AuroraBackdrop } from "@/components/shared/aurora-backdrop";
import { Container } from "@/components/layout/container";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CopyButton } from "@/components/shared/copy-button";
import { LATEST } from "@/lib/releases";
import { useDetectedOS, getOSLabel } from "@/components/shared/os-detector";

export function Hero() {
  const t = useTranslations();
  const os = useDetectedOS();

  return (
    <section className="relative overflow-hidden py-24 sm:py-32 lg:py-40">
      <AuroraBackdrop />
      <Container className="relative z-10">
        <div className="mx-auto max-w-3xl text-center">
          {/* Eyebrow */}
          <a
            href={`${LATEST.repoUrl}/releases/tag/${LATEST.tag}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Badge className="mb-6 hover:border-accent/40 transition-colors">
              {t("hero.eyebrow")} <ArrowRight className="ml-1 h-3 w-3" />
            </Badge>
          </a>

          {/* Title */}
          <h1 className="font-[var(--font-display)] text-4xl font-bold tracking-tight text-foreground sm:text-6xl lg:text-7xl">
            {t("hero.title").split("\n").map((line, i) => (
              <span key={i}>
                {line}
                {i < 2 && <br />}
              </span>
            ))}
          </h1>

          {/* Subtitle */}
          <p className="mt-6 text-lg text-muted sm:text-xl max-w-2xl mx-auto leading-relaxed">
            {t("hero.subtitle")}
          </p>

          {/* CTAs */}
          <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link href="#download">
              <Button size="lg" className="min-w-[200px]">
                {t("hero.ctaPrimary", { os: getOSLabel(os) })}
              </Button>
            </Link>
            <a
              href={LATEST.repoUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="secondary" size="lg" className="min-w-[200px]">
                <Github className="h-4 w-4" />
                {t("hero.ctaSecondary")}
              </Button>
            </a>
          </div>

          {/* Install one-liner */}
          <div className="mt-12 mx-auto max-w-xl">
            <Tabs defaultValue="macos">
              <TabsList className="mx-auto">
                <TabsTrigger value="macos">
                  {t("hero.installTab.macos")}
                </TabsTrigger>
                <TabsTrigger value="windows">
                  {t("hero.installTab.windows")}
                </TabsTrigger>
                <TabsTrigger value="go">
                  {t("hero.installTab.go")}
                </TabsTrigger>
              </TabsList>
              <TabsContent value="macos">
                <div className="flex items-center gap-2 rounded-lg border border-border bg-[var(--color-ink-900)] px-4 py-3">
                  <code className="flex-1 text-sm font-mono text-[var(--color-ice-200)] truncate">
                    {LATEST.installScriptUnix}
                  </code>
                  <CopyButton text={LATEST.installScriptUnix} />
                </div>
              </TabsContent>
              <TabsContent value="windows">
                <div className="flex items-center gap-2 rounded-lg border border-border bg-[var(--color-ink-900)] px-4 py-3">
                  <code className="flex-1 text-sm font-mono text-[var(--color-ice-200)] truncate">
                    {LATEST.installScriptWin}
                  </code>
                  <CopyButton text={LATEST.installScriptWin} />
                </div>
              </TabsContent>
              <TabsContent value="go">
                <div className="flex items-center gap-2 rounded-lg border border-border bg-[var(--color-ink-900)] px-4 py-3">
                  <code className="flex-1 text-sm font-mono text-[var(--color-ice-200)] truncate">
                    {LATEST.goInstallCmd}
                  </code>
                  <CopyButton text={LATEST.goInstallCmd} />
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </Container>
    </section>
  );
}
