"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Menu, X } from "lucide-react";
import { Container } from "@/components/layout/container";
import { DocsSidebar } from "@/components/docs/docs-sidebar";

export default function DocsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Container className="py-8 lg:py-12">
      <div className="lg:grid lg:grid-cols-[240px_1fr] lg:gap-8">
        {/* Desktop sidebar */}
        <aside className="hidden lg:block">
          <div className="sticky top-20">
            <DocsSidebar />
          </div>
        </aside>

        {/* Mobile sidebar */}
        <MobileSidebar />

        {/* Content */}
        <div className="min-w-0">
          <article className="prose prose-invert max-w-none prose-headings:text-foreground prose-p:text-muted prose-a:text-accent prose-strong:text-foreground prose-code:text-[var(--color-ice-200)] prose-code:bg-[var(--color-ink-800)] prose-code:rounded prose-code:px-1.5 prose-code:py-0.5 prose-pre:bg-[var(--color-ink-900)] prose-pre:border prose-pre:border-border">
            {children}
          </article>
        </div>
      </div>
    </Container>
  );
}

function MobileSidebar() {
  const [open, setOpen] = useState(false);
  const t = useTranslations("docs");

  return (
    <div className="lg:hidden mb-6">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted hover:text-foreground border border-border cursor-pointer"
      >
        {open ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
        {t("title")}
      </button>
      {open && (
        <div className="mt-2 rounded-lg border border-border bg-card p-4">
          <DocsSidebar />
        </div>
      )}
    </div>
  );
}
