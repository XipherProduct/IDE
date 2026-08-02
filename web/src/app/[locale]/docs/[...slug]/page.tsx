import { notFound } from "next/navigation";
import { getDoc, listDocs } from "@/lib/mdx";
import { MDXRemote } from "@/components/docs/mdx-remote-wrapper";
import type { Metadata } from "next";

export async function generateStaticParams() {
  const locales = ["ru", "en"];
  const params: { locale: string; slug: string[] }[] = [];

  for (const locale of locales) {
    const docs = listDocs(locale);
    for (const doc of docs) {
      params.push({ locale, slug: [doc.slug] });
    }
  }

  return params;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string[] }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const doc = getDoc(locale, slug[0]);
  if (!doc) return {};

  return {
    title: doc.frontmatter.title,
    description: doc.frontmatter.description,
    alternates: {
      languages: {
        ru: `/ru/docs/${slug[0]}`,
        en: `/en/docs/${slug[0]}`,
      },
    },
  };
}

export default async function DocPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string[] }>;
}) {
  const { locale, slug } = await params;
  const doc = getDoc(locale, slug[0]);

  if (!doc) {
    notFound();
  }

  return (
    <div>
      <h1 className="text-3xl font-bold mb-2">{doc.frontmatter.title}</h1>
      <p className="text-muted mb-8">{doc.frontmatter.description}</p>
      <MDXRemote source={doc.content} />
    </div>
  );
}
