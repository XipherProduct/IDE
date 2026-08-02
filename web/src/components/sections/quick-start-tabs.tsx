"use client";

import { useTranslations } from "next-intl";
import { Container } from "@/components/layout/container";
import { SectionHeading } from "@/components/shared/section-heading";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CopyButton } from "@/components/shared/copy-button";
import { LATEST } from "@/lib/releases";

export function QuickStartTabs() {
  const t = useTranslations();

  return (
    <section className="py-20 sm:py-28">
      <Container>
        <SectionHeading
          title={t("quickstart.title")}
          subtitle={t("quickstart.subtitle")}
        />

        <div className="mx-auto max-w-2xl space-y-8">
          {/* Step 1: Install */}
          <div>
            <h3 className="text-sm font-semibold text-accent mb-2 uppercase tracking-wider">
              1. {t("quickstart.step1")}
            </h3>
            <Tabs defaultValue="macos">
              <TabsList>
                <TabsTrigger value="macos">macOS / Linux</TabsTrigger>
                <TabsTrigger value="windows">Windows</TabsTrigger>
                <TabsTrigger value="go">Go</TabsTrigger>
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

          {/* Step 2: Configure */}
          <div>
            <h3 className="text-sm font-semibold text-accent mb-2 uppercase tracking-wider">
              2. {t("quickstart.step2")}
            </h3>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-[var(--color-ink-900)] px-4 py-3">
              <code className="flex-1 text-sm font-mono text-[var(--color-ice-200)]">
                {t("quickstart.addKeyCmd")}
              </code>
              <CopyButton text={t("quickstart.addKeyCmd")} />
            </div>
          </div>

          {/* Step 3: Start */}
          <div>
            <h3 className="text-sm font-semibold text-accent mb-2 uppercase tracking-wider">
              3. {t("quickstart.step3")}
            </h3>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-[var(--color-ink-900)] px-4 py-3">
              <code className="flex-1 text-sm font-mono text-[var(--color-ice-200)]">
                {t("quickstart.startCmd")}
              </code>
              <CopyButton text={t("quickstart.startCmd")} />
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
