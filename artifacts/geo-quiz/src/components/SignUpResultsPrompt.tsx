import { Link } from "wouter";
import { Show } from "@clerk/react";
import { Compass, Save, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export function SignUpResultsPrompt() {
  return (
    <Show when="signed-out">
      <Card
        className="mb-10 border-primary/30 bg-primary/5"
        data-testid="prompt-results-signup"
      >
        <CardContent className="flex flex-col items-center gap-5 p-8 text-center sm:flex-row sm:text-left">
          <div className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
            <Compass className="h-6 w-6" />
          </div>
          <div className="flex-1 space-y-2">
            <h3 className="text-xl font-serif font-bold text-foreground">
              Like what you see? Join the adventure.
            </h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Create a free account to save this score and revisit your full quiz history any time.
            </p>
            <ul className="flex flex-wrap justify-center gap-x-5 gap-y-1 pt-1 text-sm text-muted-foreground sm:justify-start">
              <li className="flex items-center gap-1.5">
                <Save className="h-3.5 w-3.5 text-primary" /> Save your scores
              </li>
              <li className="flex items-center gap-1.5">
                <History className="h-3.5 w-3.5 text-primary" /> Track your quiz history
              </li>
            </ul>
          </div>
          <div className="flex shrink-0 flex-col gap-2 sm:flex-row">
            <Button asChild size="lg" data-testid="button-results-signup">
              <Link href="/sign-up">Join the adventure</Link>
            </Button>
            <Button asChild variant="outline" size="lg" data-testid="button-results-signin">
              <Link href="/sign-in">Sign in</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </Show>
  );
}
