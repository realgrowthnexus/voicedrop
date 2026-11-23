import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

// Static marketing shell: signed-in visitors who click "Sign in" are sent straight to the studio by /login.
export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <main id="main">{children}</main>
      <SiteFooter />
    </>
  );
}
