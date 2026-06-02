import { useState } from "react";
import { Link } from "wouter";
import { useGetNewsletterSubscribers } from "@workspace/api-client-react";
import { ArrowLeft, Download, Loader2, Mail, UserMinus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";

export default function AdminNewsletter() {
  const { data, isLoading } = useGetNewsletterSubscribers();
  const { toast } = useToast();
  const [isExporting, setIsExporting] = useState(false);

  const subscribers = data?.subscribers ?? [];

  const handleExport = () => {
    if (subscribers.length === 0) return;
    setIsExporting(true);
    try {
      const header = "email,subscribed_at\n";
      const escape = (v: string) => `"${v.replace(/"/g, '""')}"`;
      const rows = subscribers
        .map((s) => `${escape(s.email)},${escape(s.createdAt)}`)
        .join("\n");
      const blob = new Blob([header + rows], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `newsletter-subscribers-${stamp}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast({
        title: "Export downloaded",
        description: `${subscribers.length} subscribed email${subscribers.length === 1 ? "" : "s"}.`,
      });
    } catch {
      toast({
        title: "Export failed",
        description: "Could not download the CSV file.",
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="container max-w-4xl py-10">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
            <Link href="/admin">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
            </Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Newsletter Subscribers</h1>
          <p className="text-muted-foreground mt-1">
            Signed-in users are subscribed by default and can opt out from their profile.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleExport}
          disabled={isExporting || subscribers.length === 0}
          data-testid="button-export-subscribers"
        >
          {isExporting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Download className="mr-2 h-4 w-4" />
          )}
          Download CSV
        </Button>
      </div>

      {isLoading ? (
        <div className="flex py-20 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium">Subscribed</CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data?.subscribedCount ?? 0}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium">Opted Out</CardTitle>
                <UserMinus className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data?.optedOutCount ?? 0}</div>
              </CardContent>
            </Card>
          </div>

          {subscribers.length === 0 ? (
            <Card className="flex flex-col items-center justify-center py-16 text-center">
              <CardContent className="flex flex-col items-center pt-6">
                <Mail className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="font-semibold">No subscribers yet</p>
                <p className="text-muted-foreground text-sm mt-1 max-w-sm">
                  Emails appear here once signed-in users visit the site.
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="px-6 py-3 font-medium">Email</th>
                      <th className="px-6 py-3 font-medium">Subscribed since</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subscribers.map((s) => (
                      <tr key={s.email} className="border-b last:border-0">
                        <td className="px-6 py-3 font-medium">{s.email}</td>
                        <td className="px-6 py-3 text-muted-foreground">
                          {new Date(s.createdAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
