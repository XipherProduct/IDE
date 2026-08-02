"use client";

import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const sidebarItems = [
  { slug: "getting-started", key: "gettingStarted" },
  { slug: "installation", key: "installation" },
  { slug: "configuration", key: "configuration" },
  { slug: "commands", key: "commands" },
  { slug: "providers", key: "providers" },
  { slug: "troubleshooting", key: "troubleshooting" },
];

export function DocsSidebar() {
  const t = useTranslations("docs");
  const locale = useLocale();
  const pathname = usePathname();

  return (
    <nav className="space-y-1">
      {sidebarItems.map((item) => {
        const href = `/${locale}/docs/${item.slug}`;
        const isActive = pathname === href || pathname.endsWith(`/${item.slug}`);
        return (
          <Link
            key={item.slug}
            href={href}
            className={cn(
              "block rounded-lg px-3 py-2 text-sm transition-colors",
              isActive
                ? "bg-accent/10 text-accent font-medium"
                : "text-muted hover:text-foreground hover:bg-[var(--color-ink-800)]",
            )}
          >
            {t(`sidebar.${item.key}`)}
          </Link>
        );
      })}
    </nav>
  );
}
