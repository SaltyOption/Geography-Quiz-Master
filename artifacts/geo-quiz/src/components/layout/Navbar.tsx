import { Link, useLocation } from "wouter";
import { Compass, Settings, LogOut, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Show, useUser, useClerk } from "@clerk/react";

export function Navbar() {
  const [location] = useLocation();
  const isAdmin = location.startsWith("/admin");
  const { user } = useUser();
  const { signOut } = useClerk();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 max-w-screen-2xl items-center justify-between">
        <Link href="/" className="flex items-center space-x-2 transition-opacity hover:opacity-80">
          <div className="bg-primary text-primary-foreground p-1.5 rounded-lg">
            <Compass className="h-5 w-5" />
          </div>
          <span className="font-serif text-xl font-bold tracking-tight text-foreground">
            Atlas<span className="text-primary">Quest</span>
          </span>
        </Link>
        
        <nav className="flex items-center space-x-2">
          {isAdmin ? (
            <Button variant="ghost" asChild>
              <Link href="/">Back to Quizzes</Link>
            </Button>
          ) : (
            <Button variant="ghost" size="sm" asChild>
              <Link href="/admin">
                <Settings className="mr-2 h-4 w-4" />
                Admin
              </Link>
            </Button>
          )}

          <div className="w-px h-6 bg-border mx-2" />

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
                <UserIcon className="mr-2 h-4 w-4" />
                {user?.firstName || user?.username || 'Profile'}
              </Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={() => signOut()}>
              <LogOut className="mr-2 h-4 w-4" />
              Sign Out
            </Button>
          </Show>
        </nav>
      </div>
    </header>
  );
}
