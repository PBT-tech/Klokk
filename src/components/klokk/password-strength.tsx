import { useMemo } from "react";
import { Check, Minus } from "lucide-react";
import { cn } from "@/lib/utils";

type Req = { label: string; test: (v: string) => boolean };

const REQUIREMENTS: Req[] = [
  { label: "8+ characters", test: (v) => v.length >= 8 },
  { label: "Uppercase letter", test: (v) => /[A-Z]/.test(v) },
  { label: "Lowercase letter", test: (v) => /[a-z]/.test(v) },
  { label: "A number", test: (v) => /\d/.test(v) },
  { label: "Special character", test: (v) => /[^A-Za-z0-9]/.test(v) },
];

type Level = "none" | "weak" | "fair" | "good" | "strong";

const LEVEL_LABEL: Record<Level, string> = {
  none: "",
  weak: "Weak",
  fair: "Fair",
  good: "Good",
  strong: "Strong",
};

const LEVEL_CLASS: Record<Level, string> = {
  none: "text-muted-foreground",
  weak: "text-pw-weak",
  fair: "text-pw-fair",
  good: "text-pw-good",
  strong: "text-pw-strong",
};

const SEGMENT_BG: Record<Level, string> = {
  none: "bg-muted",
  weak: "bg-pw-weak",
  fair: "bg-pw-fair",
  good: "bg-pw-good",
  strong: "bg-pw-strong",
};

function scoreLevel(score: number): { level: Level; filled: number } {
  if (score <= 0) return { level: "none", filled: 0 };
  if (score <= 2) return { level: "weak", filled: 1 };
  if (score === 3) return { level: "fair", filled: 2 };
  if (score === 4) return { level: "good", filled: 3 };
  return { level: "strong", filled: 4 };
}

export function PasswordStrength({ value }: { value: string }) {
  const { level, filled, score } = useMemo(() => {
    const raw = REQUIREMENTS.reduce((acc, r) => acc + (r.test(value) ? 1 : 0), 0);
    const { level, filled } = scoreLevel(raw);
    return { level, filled, score: raw };
  }, [value]);

  const showMeter = value.length > 0;

  return (
    <div className="mt-2 space-y-2" aria-live="polite">
      {/* Strength meter — only while the user is typing */}
      {showMeter && (
        <div className="flex items-center gap-2">
          <div
            className="flex h-1.5 flex-1 gap-1"
            role="progressbar"
            aria-valuenow={score}
            aria-valuemin={0}
            aria-valuemax={5}
          >
            {[0, 1, 2, 3].map((i) => (
              <div
                key={i}
                className={cn(
                  "h-full flex-1 rounded-full transition-colors duration-300",
                  i < filled ? SEGMENT_BG[level] : "bg-muted",
                )}
              />
            ))}
          </div>
          <span className={cn("text-xs font-medium tabular-nums", LEVEL_CLASS[level])}>
            {LEVEL_LABEL[level]}
          </span>
        </div>
      )}

      {/* Requirement checklist — always visible as guidelines */}
      <ul className="grid grid-cols-2 gap-x-3 gap-y-1.5">
        {REQUIREMENTS.map((req) => {
          const met = req.test(value);
          return (
            <li key={req.label} className="flex items-center gap-1.5">
              {met ? (
                <Check className="size-3.5 shrink-0 text-pw-strong" aria-hidden />
              ) : (
                <Minus className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
              )}
              <span
                className={cn(
                  "text-xs leading-tight",
                  met ? "text-pw-strong" : "text-muted-foreground",
                )}
              >
                {req.label}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
