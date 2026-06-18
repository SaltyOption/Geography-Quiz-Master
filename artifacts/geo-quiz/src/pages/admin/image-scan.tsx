import { Link } from "wouter";
import {
  useScanStoredImages,
  getScanStoredImagesQueryKey,
} from "@workspace/api-client-react";
import type { ImageScanBrokenItem } from "@workspace/api-client-react";
import {
  ArrowLeft,
  CheckCircle2,
  ExternalLink,
  ImageOff,
  Loader2,
  ScanSearch,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const SOURCE_LABELS: Record<ImageScanBrokenItem["source"], string> = {
  question: "Question",
  category: "Category",
  course: "Course",
};

function fixHref(item: ImageScanBrokenItem): string {
  switch (item.source) {
    case "question":
      return item.quizId != null ? `/admin/quizzes/${item.quizId}` : "/admin";
    case "course":
      return item.slug ? `/admin/courses/${item.slug}` : "/admin/courses";
    case "category":
      return "/admin/categories";
  }
}

export default function AdminImageScan() {
  const { data, isFetching, refetch, error } = useScanStoredImages({
    query: {
      enabled: false,
      gcTime: 0,
      queryKey: getScanStoredImagesQueryKey(),
    },
  });

  const hasRun = data !== undefined;

  return (
    <div className="container max-w-4xl py-10">
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
            <Link href="/admin">
              <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
            </Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Broken Image Scan</h1>
          <p className="text-muted-foreground mt-1 max-w-2xl">
            Check every image URL stored on questions, categories, and courses
            for broken links — including ones added before image validation
            existed. Transient failures (timeouts, rate limits) are ignored.
          </p>
        </div>
        <Button
          onClick={() => refetch()}
          disabled={isFetching}
          data-testid="button-run-scan"
        >
          {isFetching ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <ScanSearch className="mr-2 h-4 w-4" />
          )}
          {hasRun ? "Re-scan" : "Run scan"}
        </Button>
      </div>

      {error ? (
        <Card className="border-destructive/50">
          <CardContent className="pt-6 text-sm text-destructive">
            The scan failed to run. Please try again.
          </CardContent>
        </Card>
      ) : isFetching ? (
        <Card className="flex flex-col items-center justify-center py-20 text-center">
          <CardContent className="flex flex-col items-center pt-6">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground mb-3" />
            <p className="font-semibold">Scanning stored image URLs…</p>
            <p className="text-muted-foreground text-sm mt-1 max-w-sm">
              External links are checked over the network, so this can take a
              little while.
            </p>
          </CardContent>
        </Card>
      ) : !hasRun ? (
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <CardContent className="flex flex-col items-center pt-6">
            <ScanSearch className="h-10 w-10 text-muted-foreground mb-3" />
            <p className="font-semibold">No scan run yet</p>
            <p className="text-muted-foreground text-sm mt-1 max-w-sm">
              Click "Run scan" to check all stored image URLs for broken links.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  URLs scanned
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.scanned}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Broken
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div
                  className={`text-2xl font-bold ${data.brokenCount > 0 ? "text-destructive" : ""}`}
                  data-testid="text-broken-count"
                >
                  {data.brokenCount}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Unverified (transient)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{data.transientCount}</div>
              </CardContent>
            </Card>
          </div>

          {data.broken.length === 0 ? (
            <Card className="flex flex-col items-center justify-center py-16 text-center">
              <CardContent className="flex flex-col items-center pt-6">
                <CheckCircle2 className="h-10 w-10 text-emerald-500 mb-3" />
                <p className="font-semibold">No broken images found</p>
                <p className="text-muted-foreground text-sm mt-1 max-w-sm">
                  Every stored image URL points at a reachable image.
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {data.broken.map((item) => (
                <Card
                  key={`${item.source}-${item.id}`}
                  data-testid={`broken-${item.source}-${item.id}`}
                >
                  <CardContent className="p-6">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <ImageOff className="h-4 w-4 text-destructive shrink-0" />
                          <Badge variant="outline">
                            {SOURCE_LABELS[item.source]}
                          </Badge>
                          <span className="font-semibold truncate">
                            {item.label}
                          </span>
                        </div>
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-sm text-primary hover:underline break-all"
                        >
                          {item.url}
                        </a>
                        <p className="mt-2 text-sm text-destructive">
                          {item.reason}
                        </p>
                      </div>
                      <Button variant="outline" size="sm" asChild>
                        <Link href={fixHref(item)}>
                          <ExternalLink className="mr-2 h-4 w-4" /> Fix
                        </Link>
                      </Button>
                    </div>
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
