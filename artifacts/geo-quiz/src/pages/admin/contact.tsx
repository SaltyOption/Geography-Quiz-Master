import { Link } from "wouter";
import { useListContactMessages } from "@workspace/api-client-react";
import { ArrowLeft, Inbox, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminContact() {
  const { data, isLoading } = useListContactMessages();
  const messages = data?.messages ?? [];

  return (
    <div className="container max-w-5xl py-10">
      <div className="mb-8">
        <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
          <Link href="/admin">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
          </Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">Contact Messages</h1>
        <p className="text-muted-foreground mt-1">
          Messages submitted through the public contact form.
        </p>
      </div>

      {isLoading ? (
        <div className="flex py-20 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-6">
          <Card className="sm:max-w-xs">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">
                Total messages
              </CardTitle>
              <Inbox className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{data?.total ?? 0}</div>
            </CardContent>
          </Card>

          {messages.length === 0 ? (
            <Card className="flex flex-col items-center justify-center py-16 text-center">
              <CardContent className="flex flex-col items-center pt-6">
                <Mail className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="font-semibold">No messages yet</p>
                <p className="text-muted-foreground text-sm mt-1 max-w-sm">
                  Submissions from the contact form will appear here.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {messages.map((m) => (
                <Card key={m.id} data-testid={`contact-message-${m.id}`}>
                  <CardContent className="p-6">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold">{m.name}</p>
                        <a
                          href={`mailto:${m.email}`}
                          className="text-sm text-primary hover:underline"
                        >
                          {m.email}
                        </a>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        {m.reason && (
                          <span className="rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
                            {m.reason}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {new Date(m.createdAt).toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <p className="mt-4 whitespace-pre-wrap text-sm text-foreground/90 leading-relaxed">
                      {m.message}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
