import type { MetadataRoute } from "next";
import { getPathname } from "@/i18n/navigation";
import { siteConfig } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const locales = ["ru", "en"];
  const pages = ["/", "/docs", "/pricing", "/blog", "/download", "/account"] as const;
  const docPages = [
    "getting-started",
    "installation",
    "configuration",
    "commands",
    "providers",
    "troubleshooting",
  ];

  const entries: MetadataRoute.Sitemap = [];

  for (const locale of locales) {
    for (const page of pages) {
      const localizedPathname = getPathname({
        locale,
        href: page,
      });

      entries.push({
        url: `${siteConfig.url}${localizedPathname}`,
        lastModified: new Date(),
        changeFrequency: "weekly",
        priority: page === "/" ? 1 : 0.8,
        alternates: {
          languages: Object.fromEntries(
            locales.map((currentLocale) => [
              currentLocale,
              `${siteConfig.url}${getPathname({
                locale: currentLocale,
                href: page,
              })}`,
            ]),
          ),
        },
      });
    }

    for (const doc of docPages) {
      entries.push({
        url: `${siteConfig.url}/${locale}/docs/${doc}`,
        lastModified: new Date(),
        changeFrequency: "monthly",
        priority: 0.6,
      });
    }
  }

  return entries;
}
