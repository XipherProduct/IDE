"use client";

import { useState } from "react";
import { Copy, Check } from "lucide-react";

export function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1 rounded-md p-1.5 text-muted hover:text-foreground hover:bg-[var(--color-ink-700)] transition-colors cursor-pointer"
      aria-label="Copy to clipboard"
    >
      {copied ? (
        <Check className="h-4 w-4 text-[var(--color-aurora-400)]" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
    </button>
  );
}
