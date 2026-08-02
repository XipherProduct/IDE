"use client";

import { useLocale } from "next-intl";
import { useParams } from "next/navigation";
import { Globe } from "lucide-react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { routing } from "@/i18n/routing";
import { usePathname, useRouter } from "@/i18n/navigation";

const localeLabels: Record<string, string> = {
  ru: "Русский",
  en: "English",
};

export function LocaleSwitcher() {
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const params = useParams<Record<string, string | string[]>>();

  function switchLocale(newLocale: string) {
    const nextParams = { ...params };
    delete nextParams.locale;

    if (Object.keys(nextParams).length > 0) {
      router.replace(
        {
          pathname,
          params: nextParams,
        } as never,
        { locale: newLocale },
      );
      return;
    }

    router.replace(pathname, { locale: newLocale });
  }

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm text-muted hover:text-foreground hover:bg-[var(--color-ink-800)] transition-colors cursor-pointer"
          aria-label="Switch language"
        >
          <Globe className="h-4 w-4" />
          <span className="hidden sm:inline">{localeLabels[locale]}</span>
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          className="z-50 min-w-[120px] rounded-lg border border-border bg-card p-1 shadow-xl"
          sideOffset={8}
          align="end"
        >
          {routing.locales.map((l) => (
            <DropdownMenu.Item
              key={l}
              className={`flex cursor-pointer items-center rounded-md px-3 py-2 text-sm transition-colors outline-none ${
                l === locale
                  ? "bg-accent/10 text-accent"
                  : "text-foreground hover:bg-[var(--color-ink-800)]"
              }`}
              onSelect={() => switchLocale(l)}
            >
              {localeLabels[l]}
            </DropdownMenu.Item>
          ))}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
