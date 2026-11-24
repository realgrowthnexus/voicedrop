import { ViewTransition } from "react";
import { SiteFooter } from "@/components/SiteFooter";
import { SiteHeader } from "@/components/SiteHeader";

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <SiteHeader />
      <ViewTransition>
        <main id="main">{children}</main>
      </ViewTransition>
      <SiteFooter />
    </>
  );
}
