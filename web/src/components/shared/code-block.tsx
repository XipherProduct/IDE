import { CopyButton } from "./copy-button";

export function CodeBlock({ code, lang = "bash" }: { code: string; lang?: string }) {
  return (
    <div className="group relative rounded-lg border border-border bg-[var(--color-ink-900)] overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <span className="text-xs text-muted font-mono">{lang}</span>
        <CopyButton text={code} />
      </div>
      <pre className="overflow-x-auto p-4">
        <code className="text-sm font-mono text-[var(--color-ice-200)]">
          {code}
        </code>
      </pre>
    </div>
  );
}
