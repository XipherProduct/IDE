import type { Metadata } from "next";
import { AccountDashboard } from "@/components/account/account-dashboard";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const messages = (await import(`../../../../messages/${locale}.json`)).default;

  return {
    title: messages.account.meta.title,
    description: messages.account.meta.description,
  };
}

export default function AccountPage() {
  return <AccountDashboard />;
}
