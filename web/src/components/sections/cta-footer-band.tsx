"use client";

import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import { Github } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AuroraBackdrop } from "@/components/shared/aurora-backdrop";
import { Container } from "@/components/layout/container";
import { LATEST } from "@/lib/releases";

export function CtaFooterBand() {
  const t = useTranslations();
  const locale = useLocale();

  return (
    <section className="relative overflow-hidden py-20 sm:py-28">
      <AuroraBackdrop />
      <Container className="relative z-10 text-center">
        <h2 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
          {t("cta.title")}
        </h2>
        <p className="mt-4 text-lg text-muted max-w-xl mx-auto">
          {t("cta.subtitle")}
        </p>
        <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Link href={`/${locale}/download`}>
            <Button size="lg" className="min-w-[180px]">
              {t("cta.primary")}
            </Button>
          </Link>
          <a
            href={LATEST.repoUrl}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button variant="secondary" size="lg" className="min-w-[180px]">
              <Github className="h-4 w-4" />
              {t("cta.secondary")}
            </Button>
          </a>
        </div>
      </Container>
    </section>
  );
}
