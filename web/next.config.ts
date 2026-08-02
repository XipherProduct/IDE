import type { NextConfig } from "next";
import createMDX from "@next/mdx";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Self-contained production server (single server.js, no router→worker
  // proxy hop). Matches the "one small node server" pattern of the other
  // xipher.pro subdomains and avoids the next start worker-proxy failure.
  output: "standalone",
  pageExtensions: ["ts", "tsx", "md", "mdx"],
  // Fix: next-intl plugin writes to deprecated experimental.turbo,
  // but Next 15.5+ reads from top-level turbopack.
  turbopack: {
    resolveAlias: {
      "next-intl/config": "./src/i18n/request.ts",
    },
  },
};

const withMDX = createMDX({
  extension: /\.mdx?$/,
});

export default withNextIntl(withMDX(nextConfig));
