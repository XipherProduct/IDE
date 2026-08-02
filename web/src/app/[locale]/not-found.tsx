import Link from "next/link";
import { useTranslations, useLocale } from "next-intl";
import { Snowflake } from "lucide-react";
import { Container } from "@/components/layout/container";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  const t = useTranslations();
  const locale = useLocale();

  return (
    <Container className="flex flex-col items-center justify-center py-32 text-center">
      <Snowflake className="h-16 w-16 text-accent mb-6 animate-pulse" />
      <h1 className="text-6xl font-bold text-foreground mb-4">
        {t("notFound.title")}
      </h1>
      <p className="text-lg text-muted mb-8 max-w-md">
        {t("notFound.desc")}
      </p>
      <Link href={`/${locale}`}>
        <Button size="lg">{t("notFound.backHome")}</Button>
      </Link>
    </Container>
  );
}
