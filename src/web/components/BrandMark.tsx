export function BrandMark({ className = "" }: { className?: string }) {
  return (
    <span className={`subops-mark ${className}`} aria-hidden="true">
      <span className="subops-mark-ring" />
    </span>
  );
}
