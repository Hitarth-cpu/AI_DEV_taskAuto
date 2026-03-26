export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`animate-pulse rounded bg-neutral-800/60 ${className}`} />;
}

export function ScriptSkeleton() {
  return (
    <div className="mt-8 p-6 bg-neutral-900/50 border border-neutral-800 rounded-xl space-y-4">
      <Skeleton className="h-5 w-48" />
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

export function AssessmentSkeleton() {
  return (
    <div className="mt-8 p-6 bg-neutral-900/50 border border-neutral-800 rounded-xl space-y-4">
      <div className="flex justify-between">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-6 w-24 rounded-full" />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-24" />
        <Skeleton className="h-24" />
      </div>
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-20 w-full" />
      <Skeleton className="h-20 w-full" />
    </div>
  );
}

export function HistorySkeleton() {
  return (
    <div className="space-y-3">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="p-3 border border-neutral-800 rounded-lg space-y-2">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/3" />
        </div>
      ))}
    </div>
  );
}
