"use client";
import dynamic from "next/dynamic";

// The studio reads the saved draft from localStorage, so it renders on the client only.
export const StudioClient = dynamic(() => import("./Studio").then((m) => m.Studio), {
  ssr: false,
  loading: () => <p className="py-10 text-graphite">Loading the studio…</p>,
});
