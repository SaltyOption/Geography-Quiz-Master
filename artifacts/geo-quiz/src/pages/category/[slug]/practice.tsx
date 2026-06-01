import { useState } from "react";
import { Link, useRoute } from "wouter";
import {
  useGetCategoryPracticeQuiz,
  getGetCategoryPracticeQuizQueryKey,
} from "@workspace/api-client-react";
import {
  CheckCircle2,
  XCircle,
  ArrowRight,
  Loader2,
  MapPin,
  ArrowLeft,
  RotateCcw,
  Trophy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import mascotThinkingUrl from "@assets/mascot_swallow_thinking.png";

export default function CategoryPracticePage() {
  const [, params] = useRoute("/category/:slug/practice");
  const slug = params?.slug ?? "";

  const { data, isLoading, error } = useGetCategoryPracticeQuiz(
    slug,
    undefined,
    { query: { enabled: !!slug, queryKey: getGetCategoryPracticeQuizQueryKey(slug) } },
  );

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [correctCount, setCorrectCount] = useState(0);
  const [finished, setFinished] = useState(false);

  const questions = data?.questions ?? [];
  const currentQuestion = questions[currentQuestionIndex];
  const progress = questions.length > 0 ? (currentQuestionIndex / questions.length) * 100 : 0;
  const isCorrect = isAnswered && currentQuestion && selectedOption === currentQuestion.correctOption;

  const handleSelectOption = (index: number) => {
    if (isAnswered || !currentQuestion) return;
    setSelectedOption(index);
    setIsAnswered(true);
    if (index === currentQuestion.correctOption) {
      setCorrectCount((c) => c + 1);
    }
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
      setSelectedOption(null);
      setIsAnswered(false);
    } else {
      setFinished(true);
    }
  };

  const handleRestart = () => {
    setCurrentQuestionIndex(0);
    setSelectedOption(null);
    setIsAnswered(false);
    setCorrectCount(0);
    setFinished(false);
  };

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data || questions.length === 0) {
    return (
      <div className="container py-16 text-center">
        <MapPin className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
        <h2 className="text-2xl font-bold">No practice questions yet</h2>
        <p className="mt-2 text-muted-foreground">
          This category doesn't have any tagged questions to practice with.
        </p>
        <Button asChild className="mt-6">
          <Link href={slug ? `/category/${slug}` : "/"}>
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to category
          </Link>
        </Button>
      </div>
    );
  }

  if (finished) {
    const pct = Math.round((correctCount / questions.length) * 100);
    return (
      <div className="container max-w-2xl py-12">
        <Card className="overflow-hidden">
          <CardContent className="flex flex-col items-center gap-4 p-10 text-center">
            <Trophy className="h-16 w-16 text-amber-500" />
            <h1 className="text-3xl font-bold">Practice complete!</h1>
            <p className="text-lg text-muted-foreground">
              You got <span className="font-bold text-foreground">{correctCount}</span> of{" "}
              {questions.length} correct ({pct}%).
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-3">
              <Button onClick={handleRestart}>
                <RotateCcw className="mr-2 h-4 w-4" /> Practice again
              </Button>
              <Button asChild variant="outline">
                <Link href={`/category/${slug}`}>
                  <ArrowLeft className="mr-2 h-4 w-4" /> Back to category
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!currentQuestion) return null;

  return (
    <div className="container max-w-3xl py-8">
      <div className="mb-8 space-y-4">
        <div className="flex items-center justify-between text-sm font-medium">
          <span className="uppercase tracking-wider text-muted-foreground">
            {data.category.name} · Practice
          </span>
          <span className="rounded-full bg-primary/10 px-3 py-1 text-primary">
            Question {currentQuestionIndex + 1} of {questions.length}
          </span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      <div className="animate-in fade-in slide-in-from-right-4 duration-300" key={currentQuestion.id}>
        <div className="mb-8 flex items-start gap-4">
          <h2 className="flex-1 font-serif text-3xl font-bold leading-tight text-foreground">
            {currentQuestion.text}
          </h2>
          {!isAnswered && (
            <img
              src={mascotThinkingUrl}
              alt=""
              aria-hidden="true"
              className="hidden h-24 w-24 shrink-0 object-contain drop-shadow-sm sm:block md:h-28 md:w-28 animate-in fade-in duration-500"
            />
          )}
        </div>
        {currentQuestion.imageUrl && (
          <div className="mb-8 flex justify-center overflow-hidden rounded-xl border bg-muted/50 p-4">
            <img
              src={
                currentQuestion.imageUrl.startsWith("/")
                  ? `${import.meta.env.BASE_URL}${currentQuestion.imageUrl.slice(1)}`
                  : currentQuestion.imageUrl
              }
              alt="Question illustration"
              className="max-h-72 w-auto object-contain"
              loading="eager"
            />
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-1">
          {currentQuestion.options.map((option, index) => {
            const isSelected = selectedOption === index;
            const isActuallyCorrect = index === currentQuestion.correctOption;

            let buttonClass =
              "justify-start h-auto min-h-[4rem] text-left p-4 whitespace-normal text-lg border-2 transition-all ";

            if (!isAnswered) {
              buttonClass += "hover:border-primary/50 hover:bg-primary/5 bg-card border-card-border shadow-sm";
            } else if (isActuallyCorrect) {
              buttonClass += "border-green-500 bg-green-500/10 text-green-900 dark:text-green-300 ring-2 ring-green-500/30";
            } else if (isSelected && !isActuallyCorrect) {
              buttonClass += "border-destructive bg-destructive/10 text-destructive ring-2 ring-destructive/30";
            } else {
              buttonClass += "opacity-50 border-card-border bg-card";
            }

            return (
              <Button
                key={index}
                variant="outline"
                className={buttonClass}
                onClick={() => handleSelectOption(index)}
                disabled={isAnswered}
              >
                <div className="flex w-full items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold">
                      {String.fromCharCode(65 + index)}
                    </span>
                    <span>{option}</span>
                  </div>
                  {isAnswered && isActuallyCorrect && <CheckCircle2 className="h-6 w-6 shrink-0 text-green-500" />}
                  {isAnswered && isSelected && !isActuallyCorrect && (
                    <XCircle className="h-6 w-6 shrink-0 text-destructive" />
                  )}
                </div>
              </Button>
            );
          })}
        </div>

        {isAnswered && (
          <div className="mt-8 animate-in slide-in-from-bottom-4 fade-in duration-300 space-y-4">
            <Card
              className={
                isCorrect
                  ? "border-green-200 bg-green-50/50 dark:border-green-900/30 dark:bg-green-900/10"
                  : "border-red-200 bg-red-50/50 dark:border-red-900/30 dark:bg-red-900/10"
              }
            >
              <CardContent className="p-6">
                <h3
                  className={`mb-2 flex items-center gap-2 text-lg font-bold ${
                    isCorrect ? "text-green-700 dark:text-green-400" : "text-destructive"
                  }`}
                >
                  {isCorrect ? (
                    <>
                      <CheckCircle2 className="h-5 w-5" /> Excellent!
                    </>
                  ) : (
                    <>
                      <XCircle className="h-5 w-5" /> Not quite.
                    </>
                  )}
                </h3>
                <p className="leading-relaxed text-foreground">{currentQuestion.explanation}</p>

                {currentQuestion.funFact && (
                  <div className="mt-4 rounded-lg border border-primary/10 bg-primary/5 p-4">
                    <h4 className="mb-1 flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-primary">
                      <MapPin className="h-4 w-4" /> Fun Fact
                    </h4>
                    <p className="text-sm text-muted-foreground">{currentQuestion.funFact}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-end pt-4">
              <Button size="lg" className="w-full px-8 text-lg sm:w-auto" onClick={handleNext}>
                {currentQuestionIndex < questions.length - 1 ? (
                  <>
                    Next Question <ArrowRight className="ml-2 h-5 w-5" />
                  </>
                ) : (
                  "See results"
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
