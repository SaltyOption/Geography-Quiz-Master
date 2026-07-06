import { Link, useLocation } from "wouter";
import { Settings, LogOut, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Show, useUser, useClerk } from "@clerk/react";
import { useGetMe } from "@workspace/api-client-react";
import { Mascot } from "@/components/Mascot";

const NAV_LINKS = [
  { href: "/", label: "Quizzes", testId: "link-nav-quizzes" },
  { href: "/courses", label: "Courses", testId: "link-courses" },
  { href: "/daily", label: "Daily Quiz", testId: "link-nav-daily" },
  { href: "/articles", label: "Articles", testId: "link-nav-articles" },
];

function isActive(location: string, href: string): boolean {
  return href === "/" ? location === "/" : location.startsWith(href);
}

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
          <Mascot
            variant="default"
            alt="World Geography Trivia"
            sizes="40px"
            loading="eager"
            className="h-10 w-10 shrink-0 object-contain drop-shadow-sm"
          />
          <span className="hidden font-serif text-lg font-bold tracking-tight text-foreground sm:inline lg:text-xl">
            World Geography<span className="text-primary"> Trivia</span>
          </span>
        </Link>

        <nav className="flex min-w-0 items-center gap-0.5 sm:gap-1">
          {!onAdminPage &&
            NAV_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                data-testid={link.testId}
                className={`hidden rounded-md px-3 py-2 text-sm font-medium transition-colors md:inline-block ${
                  isActive(location, link.href)
                    ? "font-bold text-secondary"
                    : "text-foreground/70 hover:text-foreground"
                }`}
              >
                {link.label}
              </Link>
            ))}
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
            <Button size="sm" className="rounded-full" asChild>
              <Link href="/sign-up">Sign Up Free</Link>
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
