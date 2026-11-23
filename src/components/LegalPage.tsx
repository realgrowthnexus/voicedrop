import { POLICY_UPDATED } from "@/lib/brand";

export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="mx-auto max-w-[68ch] px-4 py-10 sm:px-6 sm:py-14 [&_a]:underline [&_a]:underline-offset-4 [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-bold [&_li]:mt-1.5 [&_p]:mt-4 [&_ul]:mt-4 [&_ul]:list-disc [&_ul]:pl-6">
      <h1 className="text-4xl font-extrabold tracking-tight">{title}</h1>
      <p className="text-sm text-graphite">Last updated {POLICY_UPDATED}</p>
      {children}
    </article>
  );
}
