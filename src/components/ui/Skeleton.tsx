export function Skeleton({ className = '' }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg bg-fleet-mid/60 ${className}`} aria-hidden="true" />;
}
