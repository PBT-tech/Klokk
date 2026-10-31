import { cn } from "@/lib/utils";

export function SectionHeading({
  eyebrow,
  title,
  align = "center",
  eyebrowClassName,
  titleClassName,
  className,
}: {
  eyebrow: string;
  title: string;
  align?: "center" | "left";
  eyebrowClassName?: string;
  titleClassName?: string;
  className?: string;
}) {
  return (
    <div className={cn(align === "center" ? "mx-auto max-w-2xl text-center" : "", className)}>
      <p
        className={
          eyebrowClassName ?? "uppercase tracking-[0.18em] font-bold text-lg text-section-eyebrow"
        }
      >
        {eyebrow}
      </p>
      <h2
        className={cn(
          "mt-3 font-display text-3xl font-bold tracking-tight text-foreground text-balance sm:text-4xl",
          titleClassName,
        )}
      >
        {title}
      </h2>
    </div>
  );
}
