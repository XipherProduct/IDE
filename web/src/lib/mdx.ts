import fs from "fs";
import path from "path";
import matter from "gray-matter";
import type { DocEntry, DocFrontmatter, BlogEntry, BlogFrontmatter } from "@/types/content";

const CONTENT_DIR = path.join(process.cwd(), "content");

function stripNumericPrefix(filename: string): string {
  return filename.replace(/^\d+-/, "");
}

// ---- Docs ----

export function listDocs(locale: string): DocEntry[] {
  const docsDir = path.join(CONTENT_DIR, "docs", locale);

  if (!fs.existsSync(docsDir)) return [];

  const files = fs.readdirSync(docsDir).filter((f) => f.endsWith(".mdx"));

  return files
    .map((file) => {
      const raw = fs.readFileSync(path.join(docsDir, file), "utf8");
      const { data, content } = matter(raw);

      return {
        slug: stripNumericPrefix(file.replace(/\.mdx$/, "")),
        frontmatter: data as DocFrontmatter,
        content,
      };
    })
    .sort((a, b) => a.frontmatter.order - b.frontmatter.order);
}

export function getDoc(locale: string, slug: string): DocEntry | null {
  const docsDir = path.join(CONTENT_DIR, "docs", locale);

  if (!fs.existsSync(docsDir)) return null;

  const files = fs.readdirSync(docsDir).filter((f) => f.endsWith(".mdx"));

  for (const file of files) {
    const strippedSlug = stripNumericPrefix(file.replace(/\.mdx$/, ""));
    if (strippedSlug === slug) {
      const raw = fs.readFileSync(path.join(docsDir, file), "utf8");
      const { data, content } = matter(raw);
      return {
        slug: strippedSlug,
        frontmatter: data as DocFrontmatter,
        content,
      };
    }
  }

  return null;
}

// ---- Blog ----

function calculateReadingTime(content: string): number {
  const words = content.trim().split(/\s+/).length;
  return Math.max(1, Math.ceil(words / 200));
}

export function listPosts(locale: string): BlogEntry[] {
  const blogDir = path.join(CONTENT_DIR, "blog", locale);

  if (!fs.existsSync(blogDir)) return [];

  const files = fs.readdirSync(blogDir).filter((f) => f.endsWith(".mdx"));

  return files
    .map((file) => {
      const raw = fs.readFileSync(path.join(blogDir, file), "utf8");
      const { data, content } = matter(raw);

      return {
        slug: file.replace(/\.mdx$/, ""),
        frontmatter: data as BlogFrontmatter,
        content,
        readingTime: calculateReadingTime(content),
      };
    })
    .sort(
      (a, b) =>
        new Date(b.frontmatter.date).getTime() -
        new Date(a.frontmatter.date).getTime(),
    );
}

export function getPost(locale: string, slug: string): BlogEntry | null {
  const blogDir = path.join(CONTENT_DIR, "blog", locale);
  const filePath = path.join(blogDir, `${slug}.mdx`);

  if (!fs.existsSync(filePath)) return null;

  const raw = fs.readFileSync(filePath, "utf8");
  const { data, content } = matter(raw);

  return {
    slug,
    frontmatter: data as BlogFrontmatter,
    content,
    readingTime: calculateReadingTime(content),
  };
}
