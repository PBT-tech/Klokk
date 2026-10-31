import { Link, useRouterState } from "@tanstack/react-router";
import { Calendar, LayoutDashboard, LogOut, Settings } from "lucide-react";

import { KlokkLogo } from "./logo";
import { ThemeToggle } from "./theme-toggle";
import { cn } from "@/lib/utils";
import { useSession, useAuthActions } from "@/lib/klokk-hooks";
import { toast } from "sonner";

export function SiteHeader() {
  const session = useSession();
  const { signOut } = useAuthActions();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const isAuthed = !!session;

  const handleSignOut = () => {
    signOut();
    toast.success("Signed out");
  };

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border/70 bg-background/80 backdrop-blur-xl supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6 bg-chart-4">
        <Link to="/" className="flex items-center" aria-label="Klokk home">
          <KlokkLogo />
        </Link>

        <nav className="flex items-center gap-1 sm:gap-2">
          {isAuthed ? (
            <>
              <NavLink to="/dashboard" active={pathname.startsWith("/dashboard")}>
                <LayoutDashboard className="size-4" />
                <span className="hidden sm:inline">Dashboard</span>
              </NavLink>
              <NavLink to="/settings" active={pathname.startsWith("/settings")}>
                <Settings className="size-4" />
                <span className="hidden sm:inline">Settings</span>
              </NavLink>
              <button
                type="button"
                onClick={handleSignOut}
                className={cn(
                  "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-surface hover:text-foreground",
                )}
              >
                <LogOut className="size-4" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </>
          ) : (
            <>
              <NavLink to="/signin" active={pathname === "/signin"}>
                Sign in
              </NavLink>
              <Link
                to="/signup"
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-premium transition-all hover:opacity-95 active:scale-[0.98]"
              >
                <Calendar className="size-4" />
                Create a free event
              </Link>
            </>
          )}
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}

function NavLink({
  to,
  active,
  children,
}: {
  to: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      to={to}
      className={cn(
        "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors border-primary-foreground text-chart-4 hover:bg-surface hover:opacity-80 bg-accent-foreground text-card-foreground",
        active ? "bg-surface text-chart-4" : "text-chart-4 hover:bg-surface hover:opacity-80",
      )}
    >
      {children}
    </Link>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border/70 bg-background">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex flex-col gap-1">
          <KlokkLogo />
          <p className="text-xs text-muted-foreground">
            Find a time that works for everyone — fast.
          </p>
        </div>
        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} Klokk · Premium meeting co-ordinator
        </p>
      </div>
    </footer>
  );
}
