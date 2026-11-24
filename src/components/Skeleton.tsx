/** Shimmering placeholder shown while content loads. */
export function Skeleton({ className = "", label }: { className?: string; label?: string }) {
  return <div className={`skeleton ${className}`} aria-hidden={label ? undefined : true} role={label ? "status" : undefined} aria-label={label} />;
}

export function SkeletonPage({ rows = 3 }: { rows?: number }) {
  return (
    <div className="space-y-6 py-2" role="status" aria-label="Loading">
      <Skeleton className="h-10 w-56" />
      <Skeleton className="h-4 w-80 max-w-full" />
      <div className="space-y-3 pt-4">
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full rounded-[18px]" />
        ))}
      </div>
    </div>
  );
}
