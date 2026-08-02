import { useTranslations } from "next-intl";
import { Download, ExternalLink, AlertTriangle } from "lucide-react";
import { Container } from "@/components/layout/container";
import { SectionHeading } from "@/components/shared/section-heading";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/shared/copy-button";
import { LATEST, getAssetUrl } from "@/lib/releases";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const messages = (await import(`../../../../messages/${locale}.json`)).default;
  return {
    title: messages.download.pageTitle,
    description: messages.download.pageSubtitle.replace("{version}", LATEST.version),
  };
}

export default function DownloadPage() {
  const t = useTranslations();

  return (
    <Container className="py-16 sm:py-24">
      <SectionHeading
        title={t("download.pageTitle")}
        subtitle={t("download.pageSubtitle", { version: LATEST.version })}
      />

      {/* Binary downloads */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto mb-12">
        {LATEST.assets.map((asset) => (
          <Card key={asset.platform}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-semibold text-foreground">
                  {asset.os}
                </h3>
                <p className="text-xs text-muted">{asset.arch}</p>
              </div>
              <span className="text-xs text-muted">
                {asset.sizeLabel}
              </span>
            </div>
            <a
              href={getAssetUrl(asset.filename)}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button variant="secondary" size="sm" className="w-full">
                <Download className="h-3.5 w-3.5" />
                {t("download.title")}
              </Button>
            </a>
            <p className="mt-2 text-xs text-muted font-mono truncate">
              {asset.filename}
            </p>
          </Card>
        ))}
      </div>

      {/* Go install */}
      <div className="max-w-2xl mx-auto mb-12">
        <h3 className="text-lg font-semibold text-foreground mb-3">
          {t("download.goInstall")}
        </h3>
        <div className="flex items-center gap-2 rounded-lg border border-border bg-[var(--color-ink-900)] px-4 py-3">
          <code className="flex-1 text-sm font-mono text-[var(--color-ice-200)] truncate">
            {LATEST.goInstallCmd}
          </code>
          <CopyButton text={LATEST.goInstallCmd} />
        </div>
      </div>

      {/* Verification */}
      <div className="max-w-2xl mx-auto mb-12">
        <h3 className="text-lg font-semibold text-foreground mb-3">
          {t("download.verification")}
        </h3>
        <p className="text-sm text-muted mb-4">
          {t("download.verificationDesc")}
        </p>
        <div className="rounded-lg border border-border bg-[var(--color-ink-900)] p-4">
          <code className="text-sm font-mono text-[var(--color-ice-200)] block space-y-1">
            <span className="block">
              # Download checksums
            </span>
            <span className="block text-[var(--color-aurora-400)]">
              curl -sL {LATEST.checksumsUrl} -o checksums.txt
            </span>
            <span className="block mt-2">
              # Verify (Linux/macOS)
            </span>
            <span className="block text-[var(--color-aurora-400)]">
              sha256sum -c checksums.txt --ignore-missing
            </span>
          </code>
        </div>
      </div>

      {/* Prerequisites */}
      <div className="max-w-2xl mx-auto">
        <h3 className="text-lg font-semibold text-foreground mb-3">
          {t("download.prerequisites")}
        </h3>
        <Card className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-yellow-400 shrink-0 mt-0.5" />
          <p className="text-sm text-muted">
            {t("download.linuxNote")}
          </p>
        </Card>
      </div>

      {/* Checksums link */}
      <div className="mt-8 text-center">
        <a
          href={LATEST.checksumsUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-accent hover:underline"
        >
          {t("download.checksums")} <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </Container>
  );
}
