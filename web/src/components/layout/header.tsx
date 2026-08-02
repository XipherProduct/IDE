"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Menu, X, Snowflake } from "lucide-react";
import { Container } from "./container";
import { ThemeToggle } from "./theme-toggle";
import { LocaleSwitcher } from "./locale-switcher";
import { Button } from "@/components/ui/button";
import { navItems } from "@/lib/nav";
import { Link } from "@/i18n/navigation";

export function Header() {
  const t = useTranslations();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
      <Container className="flex h-16 items-center justify-between">
        {/* Logo */}
        <Link
          href="/"
          className="flex items-center gap-2 text-lg font-bold text-foreground"
        >
          <Snowflake className="h-6 w-6 text-accent" />
          <span>Xipher IDE</span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href as "/" | "/docs" | "/pricing" | "/blog" | "/download"}
              className="rounded-lg px-3 py-2 text-sm text-muted hover:text-foreground hover:bg-[var(--color-ink-800)] transition-colors"
            >
              {t(item.titleKey)}
            </Link>
          ))}
        </nav>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <LocaleSwitcher />
          <ThemeToggle />
          <Button variant="outline" size="sm" asChild className="hidden sm:inline-flex">
            <Link href="/account">{t("nav.account")}</Link>
          </Button>
          <Button variant="secondary" size="sm" asChild className="hidden sm:inline-flex">
            <a
              href="https://github.com/xipher-pro/xipher-ide"
              target="_blank"
              rel="noopener noreferrer"
            >
              {t("nav.github")}
            </a>
          </Button>

          {/* Mobile toggle */}
          <button
            className="md:hidden rounded-lg p-2 text-foreground hover:bg-[var(--color-ink-800)] transition-colors cursor-pointer"
            onClick={() => setMobileOpen(!mobileOpen)}
            aria-label="Toggle menu"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </Container>

      {/* Mobile nav */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border bg-background">
          <Container className="py-4 flex flex-col gap-2">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href as "/" | "/docs" | "/pricing" | "/blog" | "/download"}
                className="rounded-lg px-3 py-2 text-sm text-muted hover:text-foreground hover:bg-[var(--color-ink-800)] transition-colors"
                onClick={() => setMobileOpen(false)}
              >
                {t(item.titleKey)}
              </Link>
            ))}
            <Link
              href="/account"
              className="rounded-lg px-3 py-2 text-sm text-muted hover:text-foreground hover:bg-[var(--color-ink-800)] transition-colors"
              onClick={() => setMobileOpen(false)}
            >
              {t("nav.account")}
            </Link>
            <a
              href="https://github.com/xipher-pro/xipher-ide"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-2"
            >
              <Button variant="secondary" size="sm" className="w-full">
                {t("nav.github")}
              </Button>
            </a>
          </Container>
        </div>
      )}
    </header>
  );
}
