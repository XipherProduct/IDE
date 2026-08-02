export interface NavItem {
  titleKey: string;
  href: string;
}

export const navItems: NavItem[] = [
  { titleKey: "nav.docs", href: "/docs" },
  { titleKey: "nav.pricing", href: "/pricing" },
  { titleKey: "nav.blog", href: "/blog" },
  { titleKey: "nav.download", href: "/download" },
];
