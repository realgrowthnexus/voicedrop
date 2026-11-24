import { POLICY_UPDATED } from "@/lib/brand";

export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="mx-auto max-w-[68ch] px-5 pb-10 pt-32 sm:px-8 sm:pt-40 [&_p]:text-mute [&_li]:text-mute [&_h2]:tracking-[-0.02em] [&_a]:underline [&_a]:underline-offset-4 [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-bold [&_li]:mt-1.5 [&_p]:mt-4 [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:pl-6">
      <h1 className="title text-[clamp(2.4rem,6vw,4rem)]">{title}</h1>
      <p className="text-sm text-mute">Last updated {POLICY_UPDATED}</p>
      {children}
    </article>
  );
}
