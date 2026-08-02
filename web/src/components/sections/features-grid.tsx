import { useTranslations } from "next-intl";
import { Container } from "@/components/layout/container";
import { SectionHeading } from "@/components/shared/section-heading";
import { Card } from "@/components/ui/card";
import { features } from "@/lib/features";

export function FeaturesGrid() {
  const t = useTranslations();

  return (
    <section className="py-20 sm:py-28">
      <Container>
        <SectionHeading
          title={t("features.title")}
          subtitle={t("features.subtitle")}
        />

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => {
            const Icon = feature.icon;
            return (
              <Card
                key={feature.id}
                className="group hover:border-accent/30 transition-all"
              >
                <div className="flex items-start gap-4">
                  <div className="rounded-lg bg-accent/10 p-2.5 text-accent group-hover:bg-accent/20 transition-colors">
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-semibold text-foreground">
                      {t(feature.titleKey)}
                    </h3>
                    <p className="text-sm text-muted leading-relaxed">
                      {t(feature.descKey)}
                    </p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
