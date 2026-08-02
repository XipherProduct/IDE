export interface DocFrontmatter {
  title: string;
  description: string;
  order: number;
}

export interface DocEntry {
  slug: string;
  frontmatter: DocFrontmatter;
  content: string;
}

export interface BlogFrontmatter {
  title: string;
  description: string;
  date: string;
  author: string;
  tags: string[];
  cover?: string;
}

export interface BlogEntry {
  slug: string;
  frontmatter: BlogFrontmatter;
  content: string;
  readingTime: number;
}
