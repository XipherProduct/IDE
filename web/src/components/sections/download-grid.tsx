import { useTranslations } from "next-intl";
import { Download, ExternalLink } from "lucide-react";
import { Container } from "@/components/layout/container";
import { SectionHeading } from "@/components/shared/section-heading";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CopyButton } from "@/components/shared/copy-button";
import { LATEST, getAssetUrl } from "@/lib/releases";

export function DownloadGrid() {
  const t = useTranslations();

  return (
    <section id="download" className="py-20 sm:py-28 bg-[var(--color-ink-900)]">
      <Container>
        <SectionHeading
          title={t("download.title")}
          subtitle={t("download.subtitle")}
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {LATEST.assets.map((asset) => (
            <Card key={asset.platform} className="flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-semibold text-foreground">
                    {asset.os}
                  </h3>
                  <span className="text-xs text-muted">{asset.arch}</span>
                </div>
                <p className="text-xs text-muted mb-4">
                  {t("download.size")}: {asset.sizeLabel}
                </p>
              </div>
              <a
                href={getAssetUrl(asset.filename)}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Button variant="secondary" size="sm" className="w-full">
                  <Download className="h-3.5 w-3.5" />
                  {asset.filename}
                </Button>
              </a>
            </Card>
          ))}
        </div>

        {/* Go install + checksums */}
        <div className="mt-8 space-y-4 max-w-2xl mx-auto">
          <div>
            <p className="text-sm text-muted mb-2">{t("download.goInstall")}:</p>
            <div className="flex items-center gap-2 rounded-lg border border-border bg-[var(--color-ink-950)] px-4 py-3">
              <code className="flex-1 text-sm font-mono text-[var(--color-ice-200)] truncate">
                {LATEST.goInstallCmd}
              </code>
              <CopyButton text={LATEST.goInstallCmd} />
            </div>
          </div>
          <div className="text-center">
            <a
              href={LATEST.checksumsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-sm text-accent hover:underline"
            >
              {t("download.checksums")} <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </div>
      </Container>
    </section>
  );
}
