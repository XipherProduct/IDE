import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import { CalendarDays, Clock, ArrowRight } from "lucide-react";
import { Container } from "@/components/layout/container";
import { SectionHeading } from "@/components/shared/section-heading";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { listPosts } from "@/lib/mdx";
import type { Metadata } from "next";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const messages = (await import(`../../../../messages/${locale}.json`)).default;
  return {
    title: messages.blog.title,
    description: messages.blog.subtitle,
  };
}

export default async function BlogPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const posts = listPosts(locale);

  return <BlogContent posts={posts} />;
}

function BlogContent({
  posts,
}: {
  posts: Awaited<ReturnType<typeof listPosts>>;
}) {
  const t = useTranslations();
  const locale = useLocale();

  return (
    <Container className="py-16 sm:py-24">
      <SectionHeading
        title={t("blog.title")}
        subtitle={t("blog.subtitle")}
      />

      {posts.length === 0 ? (
        <p className="text-center text-muted">No posts yet.</p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 max-w-5xl mx-auto">
          {posts.map((post) => (
            <Link
              key={post.slug}
              href={`/${locale}/blog/${post.slug}`}
              className="group"
            >
              <Card className="h-full hover:border-accent/30 transition-all">
                <div className="space-y-3">
                  <div className="flex flex-wrap gap-1.5">
                    {post.frontmatter.tags.map((tag) => (
                      <Badge key={tag} variant="secondary">
                        {tag}
                      </Badge>
                    ))}
                  </div>
                  <h3 className="text-lg font-semibold text-foreground group-hover:text-accent transition-colors">
                    {post.frontmatter.title}
                  </h3>
                  <p className="text-sm text-muted line-clamp-2">
                    {post.frontmatter.description}
                  </p>
                  <div className="flex items-center gap-4 text-xs text-muted">
                    <span className="flex items-center gap-1">
                      <CalendarDays className="h-3 w-3" />
                      {new Date(post.frontmatter.date).toLocaleDateString(
                        locale === "ru" ? "ru-RU" : "en-US",
                        { year: "numeric", month: "short", day: "numeric" },
                      )}
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {t("blog.readingTime", { min: post.readingTime })}
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1 text-sm text-accent font-medium">
                    {t("blog.readMore")} <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </Container>
  );
}
