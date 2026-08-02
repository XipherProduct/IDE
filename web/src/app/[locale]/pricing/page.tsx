import { useTranslations } from "next-intl";
import { Check } from "lucide-react";
import { Container } from "@/components/layout/container";
import { SectionHeading } from "@/components/shared/section-heading";
import { Card, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const messages = (await import(`../../../../messages/${locale}.json`)).default;
  return {
    title: messages.pricing.title,
    description: messages.pricing.subtitle,
  };
}

export default function PricingPage() {
  const t = useTranslations();

  const tiers = [
    {
      key: "free" as const,
      popular: true,
    },
    {
      key: "pro" as const,
      popular: false,
    },
    {
      key: "enterprise" as const,
      popular: false,
    },
  ];

  return (
    <Container className="py-16 sm:py-24">
      <SectionHeading
        title={t("pricing.title")}
        subtitle={t("pricing.subtitle")}
      />

      {/* Disclaimer */}
      <div className="mx-auto max-w-2xl mb-12 rounded-lg border border-accent/20 bg-accent/5 p-4 text-center text-sm text-muted">
        {t("pricing.disclaimer")}
      </div>

      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
        {tiers.map((tier) => {
          const features = t.raw(`pricing.${tier.key}.features`) as string[];
          return (
            <Card
              key={tier.key}
              className={`relative flex flex-col ${tier.popular ? "ring-2 ring-accent/30 border-accent/30" : ""}`}
            >
              {tier.popular && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2">
                  Open Source
                </Badge>
              )}
              <CardHeader>
                <CardTitle className="text-xl">
                  {t(`pricing.${tier.key}.name`)}
                </CardTitle>
                <CardDescription>
                  {t(`pricing.${tier.key}.desc`)}
                </CardDescription>
              </CardHeader>

              <div className="mb-6">
                <span className="text-4xl font-bold text-foreground">
                  {t(`pricing.${tier.key}.price`)}
                </span>
                {t(`pricing.${tier.key}.period`) && (
                  <span className="text-sm text-muted ml-1">
                    / {t(`pricing.${tier.key}.period`)}
                  </span>
                )}
              </div>

              <ul className="space-y-3 mb-8 flex-1">
                {features.map((feature, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-muted">
                    <Check className="h-4 w-4 text-accent mt-0.5 shrink-0" />
                    {feature}
                  </li>
                ))}
              </ul>

              <Button
                variant={tier.popular ? "default" : "secondary"}
                className="w-full"
              >
                {tier.key === "enterprise"
                  ? t(`pricing.${tier.key}.price`)
                  : tier.key === "free"
                    ? "Get Started"
                    : "Coming Soon"}
              </Button>
            </Card>
          );
        })}
      </div>
    </Container>
  );
}
