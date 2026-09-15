import React from "react";

export function SkeletonCard() {
  return (
    <div className="p-4 rounded-xl border border-zinc-800/80 bg-zinc-900/40 space-y-3 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-4 w-28 bg-zinc-800 rounded" />
        <div className="h-6 w-6 bg-zinc-800 rounded-full" />
      </div>
      <div className="h-7 w-20 bg-zinc-800 rounded" />
      <div className="h-3 w-36 bg-zinc-800 rounded" />
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2 p-4 rounded-xl border border-zinc-800 bg-zinc-900/30 animate-pulse">
      <div className="h-5 w-40 bg-zinc-800 rounded mb-4" />
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex items-center justify-between py-2 border-b border-zinc-800/60">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-zinc-800" />
            <div className="space-y-1">
              <div className="h-3.5 w-32 bg-zinc-800 rounded" />
              <div className="h-2.5 w-20 bg-zinc-800 rounded" />
            </div>
          </div>
          <div className="h-3 w-24 bg-zinc-800 rounded hidden sm:block" />
          <div className="h-6 w-16 bg-zinc-800 rounded-full" />
        </div>
      ))}
    </div>
  );
}
