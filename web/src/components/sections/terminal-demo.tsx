"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { motion } from "framer-motion";
import { Container } from "@/components/layout/container";
import { SectionHeading } from "@/components/shared/section-heading";

const terminalLines = [
  { type: "input", text: "$ xipher", delay: 0 },
  { type: "output", text: "Xipher IDE v0.4.0", delay: 600 },
  { type: "output", text: "Select a model:", delay: 1000 },
  { type: "output", text: "  1. gpt-4o", delay: 1200 },
  { type: "output", text: "  2. claude-4-sonnet", delay: 1300 },
  { type: "output", text: "  3. gemini-2.5-pro", delay: 1400 },
  { type: "input", text: "> 2", delay: 2000 },
  { type: "output", text: "Using claude-4-sonnet (Anthropic)", delay: 2400 },
  { type: "output", text: "", delay: 2600 },
  { type: "input", text: "You: What is the meaning of life?", delay: 3000 },
  { type: "output", text: "", delay: 3400 },
  {
    type: "stream",
    text: "Claude: That's a profound question. The meaning of life is deeply personal — it might be found in connections, creativity, purpose, or the simple act of being present.",
    delay: 3600,
  },
];

export function TerminalDemo() {
  const t = useTranslations();
  const [visibleLines, setVisibleLines] = useState<
    { type: string; text: string; displayed: string }[]
  >([]);
  const [isInView, setIsInView] = useState(false);
  const [hasPlayed, setHasPlayed] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !hasPlayed) {
          setIsInView(true);
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasPlayed]);

  useEffect(() => {
    if (!isInView) return;
    setHasPlayed(true);

    const timeouts: ReturnType<typeof setTimeout>[] = [];

    terminalLines.forEach((line, i) => {
      const timeout = setTimeout(() => {
        if (line.type === "stream") {
          // Simulate streaming character by character
          let charIndex = 0;
          const interval = setInterval(() => {
            charIndex++;
            setVisibleLines((prev) => {
              const copy = [...prev];
              const existing = copy.find((_, idx) => idx === i);
              if (existing) {
                existing.displayed = line.text.slice(0, charIndex);
              } else {
                copy.push({
                  type: line.type,
                  text: line.text,
                  displayed: line.text.slice(0, charIndex),
                });
              }
              return [...copy];
            });
            if (charIndex >= line.text.length) {
              clearInterval(interval);
            }
          }, 20);
        } else {
          setVisibleLines((prev) => [
            ...prev,
            { type: line.type, text: line.text, displayed: line.text },
          ]);
        }
      }, line.delay);
      timeouts.push(timeout);
    });

    return () => timeouts.forEach(clearTimeout);
  }, [isInView]);

  // For reduced motion, show all lines immediately
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const displayLines = prefersReducedMotion
    ? terminalLines.map((l) => ({
        type: l.type,
        text: l.text,
        displayed: l.text,
      }))
    : visibleLines;

  return (
    <section className="py-20 sm:py-28" ref={ref}>
      <Container>
        <SectionHeading
          title={t("terminal.title")}
          subtitle={t("terminal.subtitle")}
        />

        <div className="mx-auto max-w-2xl">
          <div className="rounded-xl border border-border bg-[var(--color-ink-950)] overflow-hidden shadow-2xl">
            {/* Title bar */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-[var(--color-ink-900)]">
              <div className="flex gap-1.5">
                <div className="h-3 w-3 rounded-full bg-red-500/70" />
                <div className="h-3 w-3 rounded-full bg-yellow-500/70" />
                <div className="h-3 w-3 rounded-full bg-green-500/70" />
              </div>
              <span className="ml-2 text-xs text-muted font-mono">
                xipher
              </span>
            </div>

            {/* Terminal content */}
            <div className="p-4 font-mono text-sm min-h-[300px] space-y-1">
              {displayLines.map((line, i) => (
                <motion.div
                  key={i}
                  initial={prefersReducedMotion ? {} : { opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.15 }}
                  className={
                    line.type === "input"
                      ? "text-[var(--color-aurora-400)]"
                      : line.type === "stream"
                        ? "text-[var(--color-ice-200)]"
                        : "text-[var(--color-ice-200)]"
                  }
                >
                  {line.displayed}
                  {line.type === "stream" &&
                    line.displayed.length < line.text.length && (
                      <span className="inline-block w-2 h-4 bg-[var(--color-glacier-400)] animate-pulse ml-0.5" />
                    )}
                </motion.div>
              ))}
              {displayLines.length > 0 &&
                displayLines[displayLines.length - 1]?.displayed ===
                  displayLines[displayLines.length - 1]?.text && (
                  <div className="text-[var(--color-aurora-400)] mt-2">
                    <span className="animate-pulse">█</span>
                  </div>
                )}
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
