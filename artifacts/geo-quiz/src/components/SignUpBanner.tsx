import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Show } from "@clerk/react";
import { Compass, X } from "lucide-react";
import { Button } from "@/components/ui/button";

const DISMISS_KEY = "geo-quiz:signup-banner-dismissed";

export function SignUpBanner() {
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(localStorage.getItem(DISMISS_KEY) === "1");
  }, []);

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setDismissed(true);
  };

  if (dismissed) return null;

  return (
    <Show when="signed-out">
      <div
        className="border-b border-primary/20 bg-primary/10 text-foreground"
        data-testid="banner-signup"
      >
        <div className="container flex max-w-screen-2xl items-center justify-between gap-4 py-2.5">
          <div className="flex items-center gap-3 text-sm">
            <Compass className="h-4 w-4 shrink-0 text-primary" />
            <p>
              <span className="font-medium">Join the adventure</span>
              <span className="text-muted-foreground">
                {" "}— create a free account to save your scores and track your quiz history.
              </span>
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button asChild size="sm" data-testid="button-banner-signup">
              <Link href="/sign-up">Join the adventure</Link>
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDismiss}
              aria-label="Dismiss"
              data-testid="button-banner-dismiss"
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </Show>
  );
}
