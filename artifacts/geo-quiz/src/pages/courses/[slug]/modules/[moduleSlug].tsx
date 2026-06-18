import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useLocation } from "wouter";
import { Show, useAuth } from "@clerk/react";
import {
  useGetCourseModule,
  getGetCourseModuleQueryKey,
  useSubmitCourseModuleAttempt,
  useSaveCourseModuleProgress,
  useClearCourseModuleProgress,
  type ModuleAttemptResult,
  type CourseQuestion,
} from "@workspace/api-client-react";
import {
  Loader2,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Trophy,
  Target,
  RotateCcw,
  Lock,
  GraduationCap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Mascot } from "@/components/Mascot";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

type FlatQuestion = CourseQuestion & { lessonTitle: string };

export default function ModuleTakingPage() {
  const { slug, moduleSlug } = useParams<{ slug: string; moduleSlug: string }>();
  const [, setLocation] = useLocation();
  const { isSignedIn, isLoaded: authLoaded } = useAuth();

  const { data, isLoading, error, refetch } = useGetCourseModule(slug!, moduleSlug!, {
    query: {
      queryKey: getGetCourseModuleQueryKey(slug!, moduleSlug!),
      enabled: authLoaded && !!isSignedIn,
    },
  });
  const submit = useSubmitCourseModuleAttempt();
  const saveProgress = useSaveCourseModuleProgress();
  const clearProgress = useClearCourseModuleProgress();

  const questions = useMemo<FlatQuestion[]>(() => {
    if (!data) return [];
    const list: FlatQuestion[] = [];
    for (const lesson of data.lessons) {
      for (const q of lesson.questions) {
        list.push({ ...q, lessonTitle: lesson.title });
      }
    }
    return list;
  }, [data]);

  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [answers, setAnswers] = useState<Array<{ questionId: number; selectedOption: number }>>([]);
  const [result, setResult] = useState<ModuleAttemptResult | null>(null);
  const [resumed, setResumed] = useState(false);

  // Restore saved progress on first load (signed-in users only).
  // The user picks up at their next un-answered question with all
  // prior answers preserved for the final score submission.
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    if (!data || !data.progress || questions.length === 0) return;
    const saved = data.progress.answers;
    const validIds = new Set(questions.map((q) => q.id));
    const filtered = saved.filter((a) => validIds.has(a.questionId));
    if (filtered.length === 0) {
      restoredRef.current = true;
      return;
    }
    restoredRef.current = true;
    setAnswers(filtered);
    if (filtered.length >= questions.length) {
      // All questions were answered but never submitted — show the last
      // question with its feedback so the user can finish.
      const last = filtered[filtered.length - 1];
      setIdx(questions.length - 1);
      setSelected(last.selectedOption);
      setAnswered(true);
    } else {
      setIdx(filtered.length);
      setSelected(null);
      setAnswered(false);
    }
    setResumed(true);
  }, [data, questions]);

  if (!authLoaded) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="container max-w-3xl py-16 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <Card className="text-center">
          <CardHeader>
            <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Lock className="h-6 w-6" />
            </div>
            <CardTitle className="text-3xl">Sign in to take this module</CardTitle>
            <CardDescription className="mt-2 text-base">
              Free account required to take any course module and track your progress.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Button asChild size="lg">
              <Link href="/sign-up">Create free account</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="/sign-in">Sign in</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // Express returns 403 with a JSON body for locked modules.
  if (error) {
    const status =
      typeof error === "object" && error !== null && "response" in error
        ? // axios-like error
          (error as { response?: { status?: number } }).response?.status
        : undefined;
    if (status === 403) {
      return (
        <div className="container max-w-2xl py-16 text-center">
          <Lock className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <h2 className="text-2xl font-bold">Module locked</h2>
          <p className="mt-2 text-muted-foreground">
            Master the previous module first to unlock this one.
          </p>
          <Button className="mt-6" asChild>
            <Link href={`/courses/${slug}`}>Back to course</Link>
          </Button>
        </div>
      );
    }
    return (
      <div className="container max-w-2xl py-16 text-center">
        <h2 className="text-2xl font-bold text-destructive">Could not load module</h2>
        <Button className="mt-4" asChild>
          <Link href={`/courses/${slug}`}>Back to course</Link>
        </Button>
      </div>
    );
  }

  if (!data) return null;

  if (questions.length === 0) {
    return (
      <div className="container max-w-2xl py-16 text-center">
        <h2 className="text-2xl font-bold">No questions in this module yet</h2>
        <Button className="mt-4" asChild>
          <Link href={`/courses/${slug}`}>Back to course</Link>
        </Button>
      </div>
    );
  }

  const current = questions[idx];
  const total = questions.length;
  const progress = (idx / total) * 100;

  const handleSelect = (optionIndex: number) => {
    if (answered || !current) return;
    setSelected(optionIndex);
    setAnswered(true);
    const nextAnswers = [...answers, { questionId: current.id, selectedOption: optionIndex }];
    setAnswers(nextAnswers);

    // Save progress for signed-in users so they can resume on a later visit.
    // Fire-and-forget — surface failures to the console only.
    if (isSignedIn) {
      saveProgress.mutate(
        { moduleId: data!.id, data: { answers: nextAnswers } },
        {
          onError: (err) => {
            // eslint-disable-next-line no-console
            console.error("Failed to save module progress", err);
          },
        },
      );
    }
  };

  const handleNext = async () => {
    if (idx < total - 1) {
      setIdx((i) => i + 1);
      setSelected(null);
      setAnswered(false);
      return;
    }
    try {
      const res = await submit.mutateAsync({
        moduleId: data.id,
        data: { answers },
      });
      setResult(res);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Failed to submit module attempt", err);
    }
  };

  const handleRetake = () => {
    setIdx(0);
    setSelected(null);
    setAnswered(false);
    setAnswers([]);
    setResult(null);
    setResumed(false);
    restoredRef.current = true;
    if (isSignedIn && data) {
      clearProgress.mutate({ moduleId: data.id });
    }
    refetch();
  };

  const handleSaveAndExit = () => {
    if (isSignedIn && data) {
      // The latest answers were already saved on each selection — just
      // navigate back to the course detail page.
      setLocation(`/courses/${data.courseSlug}`);
    } else {
      setLocation(`/courses/${data?.courseSlug ?? ""}`);
    }
  };

  if (result) {
    const passed = result.mastered;
    const next = data.nextModule;
    return (
      <div className="container max-w-2xl py-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <Card className={passed ? "border-green-500/40" : "border-amber-500/40"}>
          <CardContent className="p-8 text-center">
            <div
              className={`mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full ${
                passed ? "bg-green-500/15 text-green-600" : "bg-amber-500/15 text-amber-600"
              }`}
            >
              {passed ? <Trophy className="h-8 w-8" /> : <Target className="h-8 w-8" />}
            </div>
            <h2 className="text-3xl font-bold tracking-tight">
              {passed ? "Module mastered!" : "Almost there"}
            </h2>
            <p className="mt-2 text-muted-foreground">
              You scored {result.score} of {result.totalQuestions} ·{" "}
              <span className="font-semibold text-foreground">{result.percentage}%</span>
              {!passed && (
                <>
                  . Score {result.masteryThreshold}% or more to master this module
                  {data.nextModule ? " and unlock the next one" : ""}.
                </>
              )}
            </p>

            <div className="mt-6 flex flex-wrap justify-center gap-2">
              <Button variant="outline" onClick={handleRetake}>
                <RotateCcw className="mr-2 h-4 w-4" /> Retake module
              </Button>
              {passed && next && (
                <Button
                  onClick={() => {
                    setLocation(`/courses/${data.courseSlug}/modules/${next.slug}`);
                    handleRetake();
                  }}
                >
                  Next module <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              )}
              <Button variant="ghost" asChild>
                <Link href={`/courses/${data.courseSlug}`}>Back to course</Link>
              </Button>
            </div>
          </CardContent>
        </Card>

        <h3 className="mt-8 mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Review your answers
        </h3>
        <div className="space-y-3">
          {result.questionResults.map((qr) => {
            const q = questions.find((q) => q.id === qr.questionId);
            if (!q) return null;
            return (
              <Card
                key={qr.questionId}
                className={qr.isCorrect ? "border-green-500/30" : "border-destructive/30"}
              >
                <CardContent className="p-4">
                  <div className="mb-2 flex items-start gap-2">
                    {qr.isCorrect ? (
                      <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-green-600" />
                    ) : (
                      <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
                    )}
                    <div className="text-sm font-medium">{q.text}</div>
                  </div>
                  <div className="ml-7 text-xs text-muted-foreground">
                    Correct answer: <strong>{q.options[qr.correctOption]}</strong>
                    {!qr.isCorrect && (
                      <>
                        {" · "}You picked: <em>{q.options[qr.selectedOption]}</em>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    );
  }

  return (
    <div className="container max-w-3xl py-8">
      <Button variant="ghost" asChild className="mb-4 -ml-4 text-muted-foreground">
        <Link href={`/courses/${data.courseSlug}`}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to course
        </Link>
      </Button>

      <div className="mb-6 space-y-2">
        <div className="flex items-center justify-between text-xs font-medium uppercase tracking-wider">
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <GraduationCap className="h-3.5 w-3.5" /> {data.courseTitle} · {data.title}
          </span>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-primary">
            {idx + 1} / {total}
          </span>
        </div>
        <Progress value={progress} className="h-2" />
        <div className="flex items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            Lesson: <span className="font-medium text-foreground">{current.lessonTitle}</span>
          </div>
          {isSignedIn && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSaveAndExit}
              data-testid="button-save-and-exit"
              className="text-xs text-muted-foreground"
            >
              Save & exit
            </Button>
          )}
        </div>
      </div>

      {resumed && (
        <div
          className="mb-6 flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm"
          data-testid="banner-resumed"
        >
          <RotateCcw className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <div>
            <strong className="text-foreground">Welcome back.</strong>{" "}
            <span className="text-muted-foreground">
              We picked up where you left off. {answers.length} of {total}{" "}
              question{answers.length === 1 ? "" : "s"} already answered.
            </span>
          </div>
        </div>
      )}

      <div className="animate-in fade-in slide-in-from-right-4 duration-300" key={current.id}>
        <div className="mb-2 flex items-start gap-4">
          <h2 className="flex-1 text-2xl sm:text-3xl font-serif font-bold leading-tight">
            {current.text}
          </h2>
          {!answered && (
            <Mascot
              variant="thinking"
              alt=""
              ariaHidden
              sizes="(min-width: 768px) 96px, 80px"
              className="hidden h-20 w-20 shrink-0 object-contain drop-shadow-sm sm:block md:h-24 md:w-24 animate-in fade-in duration-500"
            />
          )}
        </div>
        {current.learningObjective && !answered && (
          <Badge variant="outline" className="mb-6 text-xs font-normal text-muted-foreground">
            Goal: {current.learningObjective}
          </Badge>
        )}

        <div className="grid gap-3">
          {current.options.map((option, i) => {
            const isSelected = selected === i;
            let cls =
              "justify-start h-auto min-h-[3.5rem] text-left p-4 whitespace-normal text-base border-2 transition-all ";
            if (!answered) {
              cls +=
                "hover:border-primary/50 hover:bg-primary/5 bg-card border-card-border shadow-sm";
            } else {
              if (isSelected)
                cls += "border-primary bg-primary/10 ring-2 ring-primary/30";
              else cls += "opacity-50 border-card-border bg-card";
            }
            return (
              <Button
                key={i}
                variant="outline"
                className={cls}
                onClick={() => handleSelect(i)}
                disabled={answered}
                data-testid={`button-option-${i}`}
              >
                <div className="flex w-full items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">
                    {String.fromCharCode(65 + i)}
                  </span>
                  <span>{option}</span>
                </div>
              </Button>
            );
          })}
        </div>

        {answered && (
          <div className="mt-6 flex justify-end pt-2">
            <Button
              size="lg"
              onClick={handleNext}
              disabled={submit.isPending}
              data-testid="button-next"
            >
              {submit.isPending && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
              {idx < total - 1 ? (
                <>
                  Next question <ArrowRight className="ml-2 h-5 w-5" />
                </>
              ) : (
                "Finish module"
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
