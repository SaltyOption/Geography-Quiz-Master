import { useMemo, useState } from "react";
import { Link, useParams, useLocation } from "wouter";
import { Show } from "@clerk/react";
import {
  useGetCourseModule,
  useSubmitCourseModuleAttempt,
  type ModuleAttemptResult,
  type CourseQuestion,
} from "@workspace/api-client-react";
import {
  Loader2,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Sparkles,
  Trophy,
  Target,
  RotateCcw,
  Lock,
  GraduationCap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

type FlatQuestion = CourseQuestion & { lessonTitle: string };

export default function ModuleTakingPage() {
  const { slug, moduleSlug } = useParams<{ slug: string; moduleSlug: string }>();
  const [, setLocation] = useLocation();

  const { data, isLoading, error, refetch } = useGetCourseModule(slug!, moduleSlug!);
  const submit = useSubmitCourseModuleAttempt();

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
  const isCorrect = answered && current && selected === current.correctOption;

  const handleSelect = (optionIndex: number) => {
    if (answered || !current) return;
    setSelected(optionIndex);
    setAnswered(true);
    setAnswers((prev) => [...prev, { questionId: current.id, selectedOption: optionIndex }]);
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
    refetch();
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

            <Show when="signed-out">
              <div className="mt-4 rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
                Your result wasn't saved.{" "}
                <Link href="/sign-in" className="text-primary underline-offset-2 hover:underline">
                  Sign in
                </Link>{" "}
                to track mastery.
              </div>
            </Show>

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
        <div className="text-xs text-muted-foreground">
          Lesson: <span className="font-medium text-foreground">{current.lessonTitle}</span>
        </div>
      </div>

      <div className="animate-in fade-in slide-in-from-right-4 duration-300" key={current.id}>
        <h2 className="mb-2 text-2xl sm:text-3xl font-serif font-bold leading-tight">
          {current.text}
        </h2>
        {current.learningObjective && !answered && (
          <Badge variant="outline" className="mb-6 text-xs font-normal text-muted-foreground">
            Goal: {current.learningObjective}
          </Badge>
        )}

        <div className="grid gap-3">
          {current.options.map((option, i) => {
            const isSelected = selected === i;
            const isAnswerCorrect = i === current.correctOption;
            let cls =
              "justify-start h-auto min-h-[3.5rem] text-left p-4 whitespace-normal text-base border-2 transition-all ";
            if (!answered) {
              cls +=
                "hover:border-primary/50 hover:bg-primary/5 bg-card border-card-border shadow-sm";
            } else {
              if (isAnswerCorrect)
                cls +=
                  "border-green-500 bg-green-500/10 text-green-900 dark:text-green-300 ring-2 ring-green-500/30";
              else if (isSelected)
                cls += "border-destructive bg-destructive/10 text-destructive ring-2 ring-destructive/30";
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
                <div className="flex w-full items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-bold">
                      {String.fromCharCode(65 + i)}
                    </span>
                    <span>{option}</span>
                  </div>
                  {answered && isAnswerCorrect && (
                    <CheckCircle2 className="h-5 w-5 shrink-0 text-green-500" />
                  )}
                  {answered && isSelected && !isAnswerCorrect && (
                    <XCircle className="h-5 w-5 shrink-0 text-destructive" />
                  )}
                </div>
              </Button>
            );
          })}
        </div>

        {answered && (
          <div className="mt-6 animate-in slide-in-from-bottom-4 fade-in duration-300 space-y-4">
            <Card
              className={
                isCorrect
                  ? "border-green-200 bg-green-50/50 dark:border-green-900/30 dark:bg-green-900/10"
                  : "border-red-200 bg-red-50/50 dark:border-red-900/30 dark:bg-red-900/10"
              }
            >
              <CardContent className="p-5">
                <h3
                  className={`text-base font-bold mb-2 flex items-center gap-2 ${
                    isCorrect ? "text-green-700 dark:text-green-400" : "text-destructive"
                  }`}
                >
                  {isCorrect ? (
                    <>
                      <CheckCircle2 className="h-5 w-5" /> Correct!
                    </>
                  ) : (
                    <>
                      <XCircle className="h-5 w-5" /> Not quite.
                    </>
                  )}
                </h3>
                <p className="text-sm text-foreground leading-relaxed">{current.explanation}</p>
                {current.funFact && (
                  <div className="mt-3 rounded-lg bg-primary/5 p-3 border border-primary/10">
                    <h4 className="flex items-center gap-2 font-bold text-primary mb-1 text-xs uppercase tracking-wider">
                      <Sparkles className="h-3.5 w-3.5" /> Fun fact
                    </h4>
                    <p className="text-sm text-muted-foreground">{current.funFact}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-end pt-2">
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
          </div>
        )}
      </div>
    </div>
  );
}
