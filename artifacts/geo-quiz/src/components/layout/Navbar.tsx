import { Link, useLocation } from "wouter";
import { Compass, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Navbar() {
  const [location] = useLocation();
  const isAdmin = location.startsWith("/admin");

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
        </nav>
      </div>
    </header>
  );
}
