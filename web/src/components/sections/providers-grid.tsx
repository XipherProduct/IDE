import { useTranslations } from "next-intl";
import { Container } from "@/components/layout/container";
import { SectionHeading } from "@/components/shared/section-heading";
import { Card } from "@/components/ui/card";
import { providers } from "@/lib/providers";

export function ProvidersGrid() {
  const t = useTranslations();

  return (
    <section className="py-20 sm:py-28 bg-[var(--color-ink-900)]">
      <Container>
        <SectionHeading
          title={t("providers.title")}
          subtitle={t("providers.subtitle")}
        />

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {providers.map((provider) => (
            <a
              key={provider.id}
              href={provider.url}
              target="_blank"
              rel="noopener noreferrer"
              className="group"
            >
              <Card className="h-full hover:border-accent/30 transition-all">
                <div className="flex items-center gap-3 mb-3">
                  {/* Gradient monogram fallback */}
                  <div
                    className="flex h-10 w-10 items-center justify-center rounded-lg text-white font-bold text-sm"
                    style={{
                      background: `linear-gradient(135deg, ${provider.color}88, ${provider.color})`,
                    }}
                  >
                    {provider.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground text-sm group-hover:text-accent transition-colors">
                      {provider.name}
                    </h3>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted">{t("providers.models")}:</p>
                  <div className="flex flex-wrap gap-1">
                    {provider.models.map((model) => (
                      <span
                        key={model}
                        className="inline-block rounded-md bg-[var(--color-ink-700)] px-2 py-0.5 text-xs text-[var(--color-ice-200)]"
                      >
                        {model}
                      </span>
                    ))}
                  </div>
                </div>
              </Card>
            </a>
          ))}
        </div>
      </Container>
    </section>
  );
}
