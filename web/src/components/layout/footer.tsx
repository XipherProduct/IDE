import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import { Snowflake } from "lucide-react";
import { Container } from "./container";

export function Footer() {
  const t = useTranslations();
  const locale = useLocale();

  return (
    <footer className="border-t border-border bg-[var(--color-ink-950)]">
      <Container className="py-12">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="space-y-4">
            <Link
              href={`/${locale}`}
              className="flex items-center gap-2 text-lg font-bold text-foreground"
            >
              <Snowflake className="h-5 w-5 text-accent" />
              Xipher IDE
            </Link>
            <p className="text-sm text-muted">
              {t("footer.builtWith")}
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3">
              {t("footer.product")}
            </h4>
            <ul className="space-y-2 text-sm text-muted">
              <li>
                <Link href={`/${locale}/docs`} className="hover:text-foreground transition-colors">
                  {t("nav.docs")}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/download`} className="hover:text-foreground transition-colors">
                  {t("nav.download")}
                </Link>
              </li>
              <li>
                <Link href={`/${locale}/pricing`} className="hover:text-foreground transition-colors">
                  {t("nav.pricing")}
                </Link>
              </li>
            </ul>
          </div>

          {/* Resources */}
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3">
              {t("footer.resources")}
            </h4>
            <ul className="space-y-2 text-sm text-muted">
              <li>
                <Link href={`/${locale}/blog`} className="hover:text-foreground transition-colors">
                  {t("nav.blog")}
                </Link>
              </li>
              <li>
                <a
                  href="https://github.com/xipher-pro/xipher-ide"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground transition-colors"
                >
                  GitHub
                </a>
              </li>
              <li>
                <a
                  href="https://github.com/xipher-pro/xipher-ide/releases"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground transition-colors"
                >
                  Releases
                </a>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="text-sm font-semibold text-foreground mb-3">
              {t("footer.legal")}
            </h4>
            <ul className="space-y-2 text-sm text-muted">
              <li>
                <a
                  href="https://github.com/xipher-pro/xipher-ide/blob/main/LICENSE"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-foreground transition-colors"
                >
                  MIT License
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 border-t border-border pt-6 text-center text-sm text-muted">
          {t("footer.copyright")}
        </div>
      </Container>
    </footer>
  );
}
