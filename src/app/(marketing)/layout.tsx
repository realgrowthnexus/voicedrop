import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";
import { hasSessionCookie } from "@/lib/has-session-cookie";

export default async function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader signedIn={await hasSessionCookie()} />
      <main id="main">{children}</main>
      <SiteFooter />
    </>
  );
}
