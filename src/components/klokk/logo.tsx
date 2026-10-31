import { cn } from "@/lib/utils";

/**
 * Klokk brand logo assets:
 * 1. KLOKK_HORIZONTAL_LOGO: Horizontal lockup (calendar + clock + people mark + Klokk + "Meeting & Workforce Coordination")
 * 2. KLOKK_STACKED_LOGO: Stacked / vertical lockup (mark on top, Klokk name below)
 * 3. KLOKK_ICON_ONLY: Standalone emblem only (calendar + clock + 3 people, no typography)
 * 4. KLOKK_DARK_HORIZONTAL_LOGO: Dark mode horizontal lockup
 */
export const KLOKK_HORIZONTAL_LOGO =
  "https://vibe.filesafe.space/1793243379516754418/attachments/8c15f8ec-8059-4fdf-bba8-7407cd20c103.png";

export const KLOKK_DARK_HORIZONTAL_LOGO =
  "https://vibe.filesafe.space/1793243379516754418/attachments/ac3c1961-3f22-4d7f-9d74-1aa5402faaf6.png";

export const KLOKK_STACKED_LOGO =
  "https://vibe.filesafe.space/1793243379516754418/attachments/5811505c-a687-4802-909c-49bcbf93f543.png";

export const KLOKK_ICON_ONLY =
  "https://vibe.filesafe.space/1793243379516754418/attachments/42cda716-91c7-4073-af97-faa797679296.png";

// Backward-compat aliases
export const KLOKK_FULL_LOGO = KLOKK_HORIZONTAL_LOGO;
export const KLOKK_ICON = KLOKK_ICON_ONLY;

/**
 * Primary navigation & inline brand mark:
 * Uses the standalone emblem (Image 3) with the styled "Klokk" brand text next to it.
 * When `showWordmark={false}`, only the emblem is displayed.
 */
export function KlokkLogo({
  className,
  showWordmark = true,
  size = "md",
}: {
  className?: string;
  showWordmark?: boolean;
  size?: "sm" | "md" | "lg" | "xl";
}) {
  const iconSizes = {
    sm: "size-6",
    md: "size-8",
    lg: "size-10",
    xl: "size-14",
  };

  const textSizes = {
    sm: "text-base",
    md: "text-lg",
    lg: "text-xl",
    xl: "text-2xl",
  };

  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <img
        src={KLOKK_ICON_ONLY}
        alt="Klokk"
        className={cn(iconSizes[size], "object-contain shrink-0 select-none")}
        loading="eager"
      />
      {showWordmark && (
        <span
          className={cn(
            "font-display font-bold tracking-tight text-foreground select-none",
            textSizes[size],
          )}
        >
          Klokk
        </span>
      )}
    </span>
  );
}

/**
 * Full branded lockup.
 * Supports:
 * - variant="horizontal": wide banner / auth headers with space (Image 1)
 * - variant="stacked": compact columns / cards where horizontal space is constrained (Image 2)
 */
export function KlokkFullLogo({
  className,
  size = "md",
  variant = "horizontal",
  imgClassName,
  adaptiveDark = true,
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
  variant?: "horizontal" | "stacked";
  showSubtitle?: boolean;
  imgClassName?: string;
  adaptiveDark?: boolean;
}) {
  const lightSrc = variant === "stacked" ? KLOKK_STACKED_LOGO : KLOKK_HORIZONTAL_LOGO;
  const darkSrc = variant === "horizontal" && adaptiveDark ? KLOKK_DARK_HORIZONTAL_LOGO : lightSrc;

  const dimensions =
    variant === "stacked"
      ? {
          sm: "h-20 w-auto max-w-[120px]",
          md: "h-28 w-auto max-w-[170px]",
          lg: "h-36 w-auto max-w-[220px]",
        }
      : {
          sm: "h-14 w-auto max-w-[200px]",
          md: "h-20 w-auto max-w-[280px]",
          lg: "h-28 w-auto max-w-[360px]",
        };

  return (
    <div className={cn("inline-flex flex-col items-center justify-center", className)}>
      {adaptiveDark && variant === "horizontal" ? (
        <>
          <img
            src={lightSrc}
            alt="Klokk — Meeting & Workforce Coordination"
            className={cn(
              "select-none object-contain mt-[-35px] w-auto h-[208px] max-w-[728px] mb-[-44px] dark:hidden",
              dimensions[size],
              imgClassName,
            )}
            loading="eager"
          />
          <img
            src={darkSrc}
            alt="Klokk — Meeting & Workforce Coordination"
            className={cn(
              "select-none object-contain mt-[-35px] w-auto h-[208px] max-w-[728px] mb-[-44px] hidden dark:block",
              dimensions[size],
              imgClassName,
            )}
            loading="eager"
          />
        </>
      ) : (
        <img
          src={lightSrc}
          alt="Klokk — Meeting & Workforce Coordination"
          className={cn(
            "select-none object-contain mt-[-35px] w-auto h-[208px] max-w-[728px] mb-[-44px]",
            dimensions[size],
            imgClassName,
          )}
          loading="eager"
        />
      )}
    </div>
  );
}
