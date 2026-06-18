import { Link } from "wouter";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border/40 bg-background/60">
      <div className="container flex h-14 max-w-screen-2xl items-center justify-between text-sm text-muted-foreground">
        <span>© {new Date().getFullYear()} World Geography Trivia</span>
        <div className="flex items-center gap-6">
          <Link
            href="/contact"
            className="font-medium hover:text-foreground hover:underline underline-offset-4"
            data-testid="link-footer-contact"
          >
            Contact
          </Link>
          <Link
            href="/privacy"
            className="font-medium hover:text-foreground hover:underline underline-offset-4"
            data-testid="link-footer-privacy"
          >
            Privacy
          </Link>
        </div>
      </div>
    </footer>
  );
}
