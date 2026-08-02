// Simple MDX renderer — renders raw markdown content as HTML
// For a production site, you'd use next-mdx-remote or similar
// This is a lightweight server-side approach

import React from "react";

function parseMDX(source: string): React.ReactNode[] {
  const lines = source.split("\n");
  const elements: React.ReactNode[] = [];
  let inCodeBlock = false;
  let codeContent = "";
  let key = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Code blocks
    if (line.startsWith("```")) {
      if (inCodeBlock) {
        elements.push(
          <pre
            key={key++}
            className="rounded-lg border border-[var(--color-border)] bg-[var(--color-ink-900)] p-4 overflow-x-auto my-4"
          >
            <code className="text-sm font-mono text-[var(--color-ice-200)]">
              {codeContent.trim()}
            </code>
          </pre>,
        );
        inCodeBlock = false;
        codeContent = "";
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeContent += line + "\n";
      continue;
    }

    // Empty lines
    if (line.trim() === "") {
      continue;
    }

    // Headings
    if (line.startsWith("### ")) {
      elements.push(
        <h3 key={key++} className="text-xl font-semibold mt-8 mb-3">
          {processInline(line.slice(4))}
        </h3>,
      );
    } else if (line.startsWith("## ")) {
      elements.push(
        <h2 key={key++} className="text-2xl font-bold mt-10 mb-4">
          {processInline(line.slice(3))}
        </h2>,
      );
    } else if (line.startsWith("# ")) {
      elements.push(
        <h1 key={key++} className="text-3xl font-bold mt-10 mb-4">
          {processInline(line.slice(2))}
        </h1>,
      );
    }
    // List items
    else if (line.startsWith("- ") || line.startsWith("* ")) {
      elements.push(
        <li key={key++} className="ml-4 list-disc text-[var(--color-fg-muted)]">
          {processInline(line.slice(2))}
        </li>,
      );
    }
    // Numbered list
    else if (/^\d+\.\s/.test(line)) {
      const text = line.replace(/^\d+\.\s/, "");
      elements.push(
        <li key={key++} className="ml-4 list-decimal text-[var(--color-fg-muted)]">
          {processInline(text)}
        </li>,
      );
    }
    // Paragraphs
    else {
      elements.push(
        <p key={key++} className="text-[var(--color-fg-muted)] leading-relaxed mb-4">
          {processInline(line)}
        </p>,
      );
    }
  }

  return elements;
}

function processInline(text: string): React.ReactNode {
  // Process inline code, bold, links
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  while (remaining.length > 0) {
    // Inline code
    const codeMatch = remaining.match(/`([^`]+)`/);
    // Bold
    const boldMatch = remaining.match(/\*\*([^*]+)\*\*/);
    // Links
    const linkMatch = remaining.match(/\[([^\]]+)\]\(([^)]+)\)/);

    let firstMatch: { type: string; index: number; match: RegExpMatchArray } | null = null;

    if (codeMatch && codeMatch.index !== undefined) {
      firstMatch = { type: "code", index: codeMatch.index, match: codeMatch };
    }
    if (boldMatch && boldMatch.index !== undefined) {
      if (!firstMatch || boldMatch.index < firstMatch.index) {
        firstMatch = { type: "bold", index: boldMatch.index, match: boldMatch };
      }
    }
    if (linkMatch && linkMatch.index !== undefined) {
      if (!firstMatch || linkMatch.index < firstMatch.index) {
        firstMatch = { type: "link", index: linkMatch.index, match: linkMatch };
      }
    }

    if (!firstMatch) {
      parts.push(remaining);
      break;
    }

    // Add text before match
    if (firstMatch.index > 0) {
      parts.push(remaining.slice(0, firstMatch.index));
    }

    if (firstMatch.type === "code") {
      parts.push(
        <code
          key={key++}
          className="bg-[var(--color-ink-800)] rounded px-1.5 py-0.5 text-sm font-mono text-[var(--color-ice-200)]"
        >
          {firstMatch.match[1]}
        </code>,
      );
    } else if (firstMatch.type === "bold") {
      parts.push(
        <strong key={key++} className="font-semibold text-[var(--color-fg)]">
          {firstMatch.match[1]}
        </strong>,
      );
    } else if (firstMatch.type === "link") {
      parts.push(
        <a
          key={key++}
          href={firstMatch.match[2]}
          className="text-[var(--color-accent)] hover:underline"
          target={firstMatch.match[2].startsWith("http") ? "_blank" : undefined}
          rel={firstMatch.match[2].startsWith("http") ? "noopener noreferrer" : undefined}
        >
          {firstMatch.match[1]}
        </a>,
      );
    }

    remaining = remaining.slice(firstMatch.index + firstMatch.match[0].length);
  }

  return parts.length === 1 ? parts[0] : <>{parts}</>;
}

export function MDXRemote({ source }: { source: string }) {
  const elements = parseMDX(source);
  return <div className="space-y-0">{elements}</div>;
}
