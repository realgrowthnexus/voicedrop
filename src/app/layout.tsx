import type { Metadata, Viewport } from "next";
import { Courier_Prime, Instrument_Sans } from "next/font/google";
import Script from "next/script";
import { SmoothScroll } from "@/components/SmoothScroll";
import { BRAND, SITE_URL, TAGLINE } from "@/lib/brand";
import "./globals.css";

const instrument = Instrument_Sans({ subsets: ["latin"], variable: "--font-instrument", display: "swap", axes: ["wdth"] });
const courier = Courier_Prime({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-courier", display: "swap" });

export const metadata: Metadata = {
  metadataBase: new URL(process.env.APP_URL ?? SITE_URL),
  title: { default: `${BRAND} — natural voice-overs for YouTube and TikTok`, template: `%s · ${BRAND}` },
  description: `${TAGLINE} Natural English voices, MP3/WAV downloads and word-timed subtitles.`,
  applicationName: BRAND,
  openGraph: {
    title: `${BRAND}: natural voice-overs for YouTube and TikTok`,
    description: `${TAGLINE} 12 natural English voices, MP3/WAV downloads and word-timed subtitles. Free every week.`,
    type: "website",
    siteName: BRAND,
    url: "/",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: `${BRAND}: natural voice-overs for YouTube and TikTok`,
    description: `${TAGLINE} Free every week.`,
  },
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = {
  themeColor: "#eef1ec",
};

// Light is the default; a saved "dark" choice is applied before paint (no flash).
const themeScript = `try{var t=localStorage.getItem("theme");if(t==="dark")document.documentElement.dataset.theme="dark"}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const umamiSrc = process.env.NEXT_PUBLIC_UMAMI_SRC;
  const umamiId = process.env.NEXT_PUBLIC_UMAMI_WEBSITE_ID;
  return (
    <html lang="en" className={`${instrument.variable} ${courier.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-dvh antialiased">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[70] focus:rounded-full focus:bg-lamp focus:px-4 focus:py-2 focus:text-lamp-ink"
        >
          Skip to content
        </a>
        <SmoothScroll />
        {children}
        <div className="grain" aria-hidden />
        {umamiSrc && umamiId ? <Script src={umamiSrc} data-website-id={umamiId} strategy="afterInteractive" /> : null}
      </body>
    </html>
  );
}
