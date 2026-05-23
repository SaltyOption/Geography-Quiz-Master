import { Link, useLocation } from "wouter";
import { Settings, LogOut, User as UserIcon, GraduationCap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Show, useUser, useClerk } from "@clerk/react";
import { useGetMe } from "@workspace/api-client-react";
import mascotUrl from "@assets/mascot_swallow.png";

export function Navbar() {
  const [location] = useLocation();
  const onAdminPage = location.startsWith("/admin");
  const { user } = useUser();
  const { signOut } = useClerk();
  const { data: me } = useGetMe();
  const isAdmin = me?.isAdmin ?? false;

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 max-w-screen-2xl items-center justify-between gap-2">
        <Link
          href="/"
          className="flex shrink-0 items-center space-x-2 transition-opacity hover:opacity-80"
        >
          <img
            src={mascotUrl}
            alt="World Geography Trivia"
            className="h-10 w-10 shrink-0 object-contain drop-shadow-sm"
          />
          <span className="hidden font-serif text-lg font-bold tracking-tight text-foreground sm:inline lg:text-xl">
            World Geography<span className="text-primary"> Trivia</span>
          </span>
        </Link>

        <nav className="flex min-w-0 items-center gap-1 sm:gap-2">
          {!onAdminPage && (
            <Button variant="ghost" size="sm" asChild data-testid="link-courses">
              <Link href="/courses">
                <GraduationCap className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Courses</span>
              </Link>
            </Button>
          )}
          {onAdminPage ? (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/">
                <span className="hidden sm:inline">Back to Quizzes</span>
                <span className="sm:hidden">Back</span>
              </Link>
            </Button>
          ) : isAdmin ? (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin">
                <Settings className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Admin</span>
              </Link>
            </Button>
          ) : null}

          <div className="mx-1 hidden h-6 w-px bg-border sm:block sm:mx-2" />

          <Show when="signed-out">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/sign-in">Sign In</Link>
            </Button>
            <Button size="sm" asChild>
              <Link href="/sign-up">Sign Up</Link>
            </Button>
          </Show>

          <Show when="signed-in">
            <Button variant="ghost" size="sm" asChild>
              <Link href="/profile">
                <UserIcon className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">
                  {user?.firstName || user?.username || "Profile"}
                </span>
              </Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => signOut()}>
              <LogOut className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">Sign Out</span>
            </Button>
          </Show>
        </nav>
      </div>
    </header>
  );
}
