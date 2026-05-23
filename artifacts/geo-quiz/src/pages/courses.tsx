import { Link } from "wouter";
import { Show } from "@clerk/react";
import {
  useListCourses,
  type CourseSummary,
} from "@workspace/api-client-react";
import { Loader2, BookOpen, ChevronRight, GraduationCap, Trophy } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";

function CourseCard({ course }: { course: CourseSummary }) {
  const baseUrl = import.meta.env.BASE_URL;
  const imgSrc = course.imageUrl
    ? course.imageUrl.startsWith("/")
      ? `${baseUrl}${course.imageUrl.slice(1)}`
      : course.imageUrl
    : null;

  const pct =
    course.moduleCount > 0
      ? Math.round((course.masteredCount / course.moduleCount) * 100)
      : 0;

  return (
    <Link href={`/courses/${course.slug}`}>
      <Card
        className="group h-full cursor-pointer overflow-hidden transition-all hover:shadow-lg hover:border-primary/50 hover:-translate-y-0.5"
        data-testid={`card-course-${course.slug}`}
      >
        {imgSrc && (
          <div className="relative h-32 w-full overflow-hidden bg-muted">
            <img
              src={imgSrc}
              alt={course.title}
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
            />
            <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-background/40 to-transparent" />
          </div>
        )}
        <CardHeader>
          <div className="mb-2 flex items-start justify-between gap-2">
            <div className="rounded-lg bg-primary/10 p-2 text-primary">
              <GraduationCap className="h-5 w-5" />
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
          </div>
          <CardTitle className="text-xl group-hover:text-primary transition-colors">
            {course.title}
          </CardTitle>
          {course.description && (
            <CardDescription className="line-clamp-2">{course.description}</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            <BookOpen className="h-3.5 w-3.5" />
            {course.moduleCount} module{course.moduleCount === 1 ? "" : "s"}
          </div>
          <Show when="signed-in">
            <div className="mt-3 space-y-1">
              <div className="flex items-center justify-between text-xs font-medium">
                <span className="text-muted-foreground">
                  {course.masteredCount} / {course.moduleCount} mastered
                </span>
                <span className="text-primary">{pct}%</span>
              </div>
              <Progress value={pct} className="h-1.5" />
            </div>
          </Show>
        </CardContent>
      </Card>
    </Link>
  );
}

export default function CoursesPage() {
  const { data: courses, isLoading, error } = useListCourses();

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container py-10">
        <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-destructive">
          <h2 className="mb-2 font-semibold">Failed to load courses</h2>
          <p>Please check your connection and try again.</p>
        </div>
      </div>
    );
  }

  const list = courses ?? [];

  return (
    <div className="container max-w-7xl py-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-10 flex flex-col gap-4 text-center md:flex-row md:items-end md:justify-between md:text-left">
        <div>
          <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-secondary/15 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-secondary">
            <GraduationCap className="h-3.5 w-3.5" /> Learning courses
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            Learn by <span className="text-secondary">course</span>
          </h1>
          <p className="mt-3 max-w-[42rem] text-lg text-muted-foreground">
            Layered lessons with explanations and fun facts. Master each module to unlock the next.
          </p>
        </div>
        <Show when="signed-in">
          <div className="hidden md:flex items-center gap-2 rounded-lg border bg-muted/40 px-4 py-2 text-sm">
            <Trophy className="h-4 w-4 text-secondary" />
            Your progress is saved across sessions.
          </div>
        </Show>
      </div>

      {list.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-16 text-center">
          <CardHeader>
            <CardTitle>No courses yet</CardTitle>
            <CardDescription>Check back soon — new learning paths are on the way.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild variant="outline">
              <Link href="/">Browse quizzes</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {list.map((c) => (
            <CourseCard key={c.id} course={c} />
          ))}
        </div>
      )}
    </div>
  );
}
