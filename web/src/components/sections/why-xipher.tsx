import { useTranslations } from "next-intl";
import { Check, X, Minus } from "lucide-react";
import { Container } from "@/components/layout/container";
import { SectionHeading } from "@/components/shared/section-heading";
import { Card } from "@/components/ui/card";

export function WhyXipher() {
  const t = useTranslations();

  const columns = [
    {
      key: "webUi" as const,
      icon: X,
      iconColor: "text-red-400",
      borderColor: "border-red-500/20",
    },
    {
      key: "perProvider" as const,
      icon: Minus,
      iconColor: "text-yellow-400",
      borderColor: "border-yellow-500/20",
    },
    {
      key: "xipher" as const,
      icon: Check,
      iconColor: "text-[var(--color-aurora-400)]",
      borderColor: "border-[var(--color-aurora-400)]/30",
      highlight: true,
    },
  ];

  return (
    <section className="py-20 sm:py-28">
      <Container>
        <SectionHeading
          title={t("why.title")}
          subtitle={t("why.subtitle")}
        />

        <div className="grid gap-6 sm:grid-cols-3">
          {columns.map((col) => {
            const Icon = col.icon;
            const items = t.raw(`why.${col.key}.items`) as string[];
            return (
              <Card
                key={col.key}
                className={`${col.borderColor} ${col.highlight ? "ring-1 ring-[var(--color-aurora-400)]/20" : ""}`}
              >
                <h3 className="font-semibold text-foreground mb-4">
                  {t(`why.${col.key}.title`)}
                </h3>
                <ul className="space-y-3">
                  {items.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Icon className={`h-4 w-4 mt-0.5 shrink-0 ${col.iconColor}`} />
                      <span className="text-muted">{item}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
