import type { Metadata, Viewport } from "next";
import { Courier_Prime, Schibsted_Grotesk } from "next/font/google";
import Script from "next/script";
import { BRAND, TAGLINE } from "@/lib/brand";
import "./globals.css";

const grotesk = Schibsted_Grotesk({ subsets: ["latin"], variable: "--font-grotesk", display: "swap" });
const courier = Courier_Prime({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-courier", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? "http://localhost:3000"),
  title: { default: `${BRAND} — natural voice-overs for YouTube and TikTok`, template: `%s · ${BRAND}` },
  description: `${TAGLINE} Natural English voices, MP3/WAV downloads and word-timed subtitles.`,
  openGraph: { title: BRAND, description: TAGLINE, type: "website" },
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f4f5f8" },
    { media: "(prefers-color-scheme: dark)", color: "#11132a" },
  ],
};

// Applies the saved theme before paint to avoid a flash.
const themeScript = `try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const umamiSrc = process.env.NEXT_PUBLIC_UMAMI_SRC;
  const umamiId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;
  return (
    <html lang="en" className={`${grotesk.variable} ${courier.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh antialiased">
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-surface focus:px-4 focus:py-2">
          Skip to content
        </a>
        {children}
        {umamiSrc && umamiId ? <Script src={umamiSrc} data-website-id={umamiId} strategy="afterInteractive" /> : null}
      </body>
    </html>
  );
}
