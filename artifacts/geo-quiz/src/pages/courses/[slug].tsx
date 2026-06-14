import { Link, useParams } from "wouter";
import { Show } from "@clerk/react";
import { useGetCourse } from "@workspace/api-client-react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { useJsonLd } from "@/hooks/useJsonLd";
import {
  Loader2,
  ArrowLeft,
  Lock,
  CheckCircle2,
  Play,
  GraduationCap,
  ListOrdered,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

export default function CourseDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: course, isLoading, error } = useGetCourse(slug!);

  const courseDescription =
    course?.description ??
    `Study ${course?.title ?? ""} on World Geography Trivia. Work through structured modules with explanations and fun facts to master geography one step at a time.`;

  usePageMeta(
    course
      ? {
          title: course.title,
          description: courseDescription,
          canonical: `${window.location.origin}/courses/${slug}`,
        }
      : null,
  );

  const courseLd = course
    ? {
        "@context": "https://schema.org",
        "@graph": [
          {
            "@type": "Course",
            name: course.title,
            description: courseDescription,
            url: `${window.location.origin}/courses/${slug}`,
            provider: {
              "@type": "Organization",
              name: "World Geography Trivia",
              url: window.location.origin,
            },
            hasCourseInstance: course.modules.map((m) => ({
              "@type": "CourseInstance",
              name: m.title,
              ...(m.description ? { description: m.description } : {}),
              url: `${window.location.origin}/courses/${slug}/modules/${m.slug}`,
            })),
          },
          {
            "@type": "BreadcrumbList",
            itemListElement: [
              {
                "@type": "ListItem",
                position: 1,
                name: "Courses",
                item: `${window.location.origin}/courses`,
              },
              {
                "@type": "ListItem",
                position: 2,
                name: course.title,
                item: `${window.location.origin}/courses/${slug}`,
              },
            ],
          },
        ],
      }
    : null;

  useJsonLd(courseLd);

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="container max-w-3xl py-10 text-center">
        <h2 className="text-2xl font-bold text-destructive">Course not found</h2>
        <Button className="mt-4" asChild>
          <Link href="/courses">Back to courses</Link>
        </Button>
      </div>
    );
  }

  const masteredCount = course.modules.filter((m) => m.mastered).length;
  const totalModules = course.modules.length;
  const overallPct = totalModules > 0 ? Math.round((masteredCount / totalModules) * 100) : 0;

  return (
    <div className="container max-w-4xl py-10">
      <Button variant="ghost" asChild className="mb-6 -ml-4 text-muted-foreground">
        <Link href="/courses">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to courses
        </Link>
      </Button>

      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
            <GraduationCap className="h-3.5 w-3.5" /> Course
          </div>
          <h1 className="text-4xl font-bold tracking-tight">{course.title}</h1>
          {course.description && (
            <p className="mt-2 max-w-2xl text-lg text-muted-foreground">{course.description}</p>
          )}
        </div>
        <Show when="signed-in">
          {totalModules > 0 && (
            <div className="md:w-64 space-y-2">
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="text-muted-foreground">
                  {masteredCount} / {totalModules} mastered
                </span>
                <span className="text-primary">{overallPct}%</span>
              </div>
              <Progress value={overallPct} className="h-2" />
            </div>
          )}
        </Show>
      </div>

      <Show when="signed-out">
        <div className="mb-6 flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Sparkles className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div className="text-sm">
              <p className="font-medium">Sign up to take this course.</p>
              <p className="text-muted-foreground">
                Free account required to answer questions, save progress, and unlock modules as you master each one.
              </p>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
            <Button asChild size="sm">
              <Link href="/sign-up">Create free account</Link>
            </Button>
            <Button asChild size="sm" variant="outline">
              <Link href="/sign-in">Sign in</Link>
            </Button>
          </div>
        </div>
      </Show>

      {course.modules.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <CardHeader>
            <CardTitle>No modules yet</CardTitle>
            <CardDescription>This course has no modules. Check back soon.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-3">
          {course.modules.map((m, idx) => {
            const isLocked = m.locked;
            const inProgress = !m.mastered && m.attempts > 0;
            return (
              <Card
                key={m.id}
                className={`transition-all ${isLocked ? "opacity-70" : "hover:shadow-md hover:border-primary/40"}`}
                data-testid={`card-module-${m.slug}`}
              >
                <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center">
                  <div className="flex items-center gap-4 flex-1">
                    <div
                      className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full text-lg font-bold ${
                        m.mastered
                          ? "bg-green-500/15 text-green-700 dark:text-green-300"
                          : isLocked
                          ? "bg-muted text-muted-foreground"
                          : "bg-primary/10 text-primary"
                      }`}
                    >
                      {m.mastered ? <CheckCircle2 className="h-6 w-6" /> : isLocked ? <Lock className="h-5 w-5" /> : idx + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-semibold leading-tight">{m.title}</h3>
                        {m.mastered && (
                          <Badge className="bg-green-500/15 text-green-700 hover:bg-green-500/15 dark:text-green-300">
                            Mastered
                          </Badge>
                        )}
                        {!m.mastered && inProgress && (
                          <Badge variant="outline" className="border-amber-500/40 text-amber-700 dark:text-amber-300">
                            In progress · {m.bestPercentage}%
                          </Badge>
                        )}
                        {isLocked && (
                          <Badge variant="outline" className="text-muted-foreground">
                            Locked
                          </Badge>
                        )}
                      </div>
                      {m.description && (
                        <p className="mt-1 text-sm text-muted-foreground line-clamp-2">{m.description}</p>
                      )}
                      <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1">
                          <ListOrdered className="h-3.5 w-3.5" />
                          {m.questionCount} question{m.questionCount === 1 ? "" : "s"}
                        </span>
                        <span>·</span>
                        <span>
                          {m.lessonCount} lesson{m.lessonCount === 1 ? "" : "s"}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0">
                    {isLocked ? (
                      <Button variant="outline" size="sm" disabled className="cursor-not-allowed">
                        <Lock className="mr-2 h-4 w-4" /> Locked
                      </Button>
                    ) : (
                      <Button asChild size="sm" data-testid={`button-start-module-${m.slug}`}>
                        <Link href={`/courses/${course.slug}/modules/${m.slug}`}>
                          <Play className="mr-2 h-4 w-4" />
                          {m.mastered ? "Retake" : inProgress ? "Continue" : "Start"}
                        </Link>
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
