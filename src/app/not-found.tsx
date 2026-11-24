import Link from "next/link";
import { LogoMark } from "@/components/Logo";

export default function NotFound() {
  return (
    <main id="main" className="grid min-h-dvh place-items-center px-5">
      <div className="max-w-md text-center">
        <span className="inline-block text-mute">
          <LogoMark size={44} />
        </span>
        <h1 className="display mt-6 text-[clamp(3rem,10vw,6rem)]">Silence.</h1>
        <p className="mt-4 text-mute">There&apos;s nothing at this address. It may have moved, or the link is incomplete.</p>
        <div className="mt-8 flex justify-center gap-3">
          <Link href="/" className="btn btn-primary">Go to the homepage</Link>
          <Link href="/dashboard" className="btn btn-secondary">Open the studio</Link>
        </div>
      </div>
    </main>
  );
}
