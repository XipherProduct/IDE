import { useTranslations } from "next-intl";
import { Container } from "@/components/layout/container";
import { SectionHeading } from "@/components/shared/section-heading";

export function Roadmap() {
  const t = useTranslations();
  const items = t.raw("roadmap.items") as {
    title: string;
    desc: string;
    status: string;
  }[];

  return (
    <section className="py-20 sm:py-28 bg-[var(--color-ink-900)]">
      <Container>
        <SectionHeading
          title={t("roadmap.title")}
          subtitle={t("roadmap.subtitle")}
        />

        <div className="mx-auto max-w-2xl">
          <div className="relative border-l-2 border-border pl-8 space-y-10">
            {items.map((item, i) => (
              <div key={i} className="relative">
                {/* Timeline dot */}
                <div className="absolute -left-[41px] top-1 h-4 w-4 rounded-full border-2 border-accent bg-[var(--color-ink-900)]" />
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-foreground">
                      {item.title}
                    </h3>
                    <span className="rounded-full bg-accent/10 px-2 py-0.5 text-xs text-accent">
                      {item.status === "planned" ? "Planned" : item.status}
                    </span>
                  </div>
                  <p className="text-sm text-muted">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </section>
  );
}
