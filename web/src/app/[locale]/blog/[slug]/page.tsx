import { notFound } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import { ArrowLeft, CalendarDays, Clock, User } from "lucide-react";
import { Container } from "@/components/layout/container";
import { Badge } from "@/components/ui/badge";
import { getPost, listPosts } from "@/lib/mdx";
import { MDXRemote } from "@/components/docs/mdx-remote-wrapper";
import type { Metadata } from "next";

export async function generateStaticParams() {
  const locales = ["ru", "en"];
  const params: { locale: string; slug: string }[] = [];

  for (const locale of locales) {
    const posts = listPosts(locale);
    for (const post of posts) {
      params.push({ locale, slug: post.slug });
    }
  }

  return params;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const post = getPost(locale, slug);
  if (!post) return {};

  return {
    title: post.frontmatter.title,
    description: post.frontmatter.description,
    alternates: {
      languages: {
        ru: `/ru/blog/${slug}`,
        en: `/en/blog/${slug}`,
      },
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  const post = getPost(locale, slug);

  if (!post) {
    notFound();
  }

  return <BlogPostContent post={post} />;
}

function BlogPostContent({
  post,
}: {
  post: NonNullable<ReturnType<typeof getPost>>;
}) {
  const t = useTranslations();
  const locale = useLocale();

  return (
    <Container className="py-16 sm:py-24">
      <div className="mx-auto max-w-3xl">
        <Link
          href={`/${locale}/blog`}
          className="inline-flex items-center gap-1 text-sm text-muted hover:text-foreground mb-8 transition-colors"
        >
          <ArrowLeft className="h-3 w-3" />
          {t("blog.backToBlog")}
        </Link>

        <div className="mb-8">
          <div className="flex flex-wrap gap-1.5 mb-4">
            {post.frontmatter.tags.map((tag) => (
              <Badge key={tag} variant="secondary">
                {tag}
              </Badge>
            ))}
          </div>

          <h1 className="text-3xl font-bold text-foreground sm:text-4xl mb-4">
            {post.frontmatter.title}
          </h1>

          <div className="flex flex-wrap items-center gap-4 text-sm text-muted">
            <span className="flex items-center gap-1">
              <User className="h-3.5 w-3.5" />
              {post.frontmatter.author}
            </span>
            <span className="flex items-center gap-1">
              <CalendarDays className="h-3.5 w-3.5" />
              {new Date(post.frontmatter.date).toLocaleDateString(
                locale === "ru" ? "ru-RU" : "en-US",
                { year: "numeric", month: "long", day: "numeric" },
              )}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {t("blog.readingTime", { min: post.readingTime })}
            </span>
          </div>
        </div>

        <article className="prose prose-invert max-w-none prose-headings:text-foreground prose-p:text-muted prose-a:text-accent prose-strong:text-foreground prose-code:text-[var(--color-ice-200)] prose-code:bg-[var(--color-ink-800)] prose-code:rounded prose-code:px-1.5 prose-code:py-0.5 prose-pre:bg-[var(--color-ink-900)] prose-pre:border prose-pre:border-border">
          <MDXRemote source={post.content} />
        </article>
      </div>
    </Container>
  );
}
