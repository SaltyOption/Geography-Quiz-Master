import type { ReactNode } from "react";
import { Link } from "wouter";
import { Loader2, ShieldAlert, ShieldCheck } from "lucide-react";
import { useGetMe } from "@workspace/api-client-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

export function AdminGuard({ children }: { children: ReactNode }) {
  const { data, isLoading, isError } = useGetMe();

  if (isLoading) {
    return (
      <div className="flex py-20 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="container max-w-xl py-20">
        <Card>
          <CardHeader>
            <CardTitle>Couldn't verify access</CardTitle>
            <CardDescription>
              We couldn't reach the server to check your permissions. Please refresh and try again.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    );
  }

  if (data.isAdmin) {
    return <>{children}</>;
  }

  if (!data.userId) {
    return (
      <div className="container max-w-xl py-20">
        <Card>
          <CardHeader>
            <div className="flex items-center gap-3">
              <div className="bg-muted text-muted-foreground p-2 rounded-lg">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <div>
                <CardTitle>Sign in required</CardTitle>
                <CardDescription>The admin area is restricted to authorized accounts.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex gap-2">
            <Button asChild>
              <Link href="/sign-in">Sign in</Link>
            </Button>
            <Button variant="outline" asChild>
              <Link href="/">Back to home</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container max-w-2xl py-16">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="bg-primary/10 text-primary p-2 rounded-lg">
              <ShieldCheck className="h-6 w-6" />
            </div>
            <div>
              <CardTitle>Not yet an admin</CardTitle>
              <CardDescription>
                You're signed in, but your account isn't on the admin allow-list.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            To grant yourself admin access, add your Clerk user ID below to the{" "}
            <code className="bg-muted px-1.5 py-0.5 rounded text-foreground font-mono text-xs">
              ADMIN_USER_IDS
            </code>{" "}
            environment variable (comma-separated for multiple admins). Set it in your hosting
            environment's variables so it's available in both development and the deployed app,
            then refresh this page.
          </p>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              Your Clerk user ID
            </div>
            <div className="bg-muted rounded-md p-3 font-mono text-sm break-all select-all">
              {data.userId}
            </div>
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={() => window.location.reload()}>I've added it — refresh</Button>
            <Button variant="outline" asChild>
              <Link href="/">Back to home</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
