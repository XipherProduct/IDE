import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["ru", "en"],
  defaultLocale: "ru",
  localePrefix: "always",
  pathnames: {
    "/": "/",
    "/docs": "/docs",
    "/pricing": { ru: "/tseny", en: "/pricing" },
    "/blog": "/blog",
    "/download": { ru: "/skachat", en: "/download" },
    "/account": { ru: "/kabinet", en: "/account" },
  },
});

export type Locale = (typeof routing.locales)[number];
export type Pathnames = keyof typeof routing.pathnames;
