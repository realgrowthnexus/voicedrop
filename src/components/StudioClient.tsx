"use client";
import dynamic from "next/dynamic";
import { Skeleton } from "./Skeleton";

function StudioSkeleton() {
  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_23rem]" role="status" aria-label="Loading the studio">
      <div>
        <div className="flex items-end justify-between">
          <Skeleton className="h-12 w-44" />
          <Skeleton className="h-10 w-56 rounded-full" />
        </div>
        <Skeleton className="mt-8 h-[22rem] w-full rounded-[20px]" />
        <div className="mt-8 grid gap-8 sm:grid-cols-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
        <Skeleton className="mt-10 h-14 w-72 rounded-full" />
      </div>
      <div className="hidden space-y-px lg:block lg:pt-[4.6rem]">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-[68px] w-full rounded-none first:rounded-t-[18px] last:rounded-b-[18px]" />
        ))}
      </div>
    </div>
  );
}

// The studio reads the saved draft from localStorage, so it renders on the client only.
export const StudioClient = dynamic(() => import("./Studio").then((m) => m.Studio), {
  ssr: false,
  loading: () => <StudioSkeleton />,
});
