export function Avatar({ emoji, size = "md", label }: { emoji: string; size?: "sm" | "md" | "lg"; label?: string }) {
  const s = size === "sm" ? "h-7 w-7 text-base" : size === "lg" ? "h-12 w-12 text-2xl" : "h-9 w-9 text-xl";
  return (
    <span
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className={`${s} inline-flex shrink-0 items-center justify-center rounded-full border border-line bg-surface-2`}
    >
      {emoji}
    </span>
  );
}
