import { useState } from "react";
import { useLocation, useParams, Link } from "wouter";
import { useGetQuiz, useSubmitQuizAttempt, getGetQuizQueryKey } from "@workspace/api-client-react";
import { ArrowRight, ChevronRight, Home, Loader2 } from "lucide-react";
import { usePageMeta, canonicalOrigin } from "@/hooks/usePageMeta";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import mascotThinkingUrl from "@assets/mascot_swallow_thinking.png";

export default function QuizPage() {
  const { id } = useParams();
  const quizId = parseInt(id || "0", 10);
  const [, setLocation] = useLocation();
  
  const { data: quizData, isLoading, error } = useGetQuiz(quizId, {
    query: { enabled: !!quizId, queryKey: getGetQuizQueryKey(quizId) }
  });

  const quizTitle = quizData?.title;
  const quizCategory = quizData?.category;
  usePageMeta(
    quizTitle
      ? {
          title: quizTitle,
          description: `Test your knowledge with the "${quizTitle}" geography quiz${quizCategory ? ` on ${quizCategory}` : ""}. Answer multiple-choice questions and see how well you know the world.`,
          canonical: `${canonicalOrigin()}/quiz/${quizId}`,
        }
      : null,
  );
  
  const submitQuiz = useSubmitQuizAttempt();

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [answers, setAnswers] = useState<Array<{questionId: number, selectedOption: number}>>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const questions = quizData?.questions || [];
  const currentQuestion = questions[currentQuestionIndex];
  const progress = questions.length > 0 ? ((currentQuestionIndex) / questions.length) * 100 : 0;

  const handleSelectOption = (index: number) => {
    if (isAnswered) return;
    setSelectedOption(index);
    setIsAnswered(true);
    setAnswers(prev => [...prev, { questionId: currentQuestion!.id, selectedOption: index }]);
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedOption(null);
      setIsAnswered(false);
    } else {
      handleComplete();
    }
  };

  const handleComplete = async () => {
    setIsSubmitting(true);
    try {
      const result = await submitQuiz.mutateAsync({
        data: {
          quizId,
          answers
        }
      });
      sessionStorage.setItem(`quiz_result_${quizId}`, JSON.stringify(result));
      setLocation(`/quiz/${quizId}/results`);
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error("Failed to submit quiz", err);
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !quizData || questions.length === 0) {
    return (
      <div className="container py-10 text-center">
        <h2 className="text-2xl font-bold text-destructive">Failed to load quiz</h2>
        <p className="text-muted-foreground mt-2">The quiz might be empty or unavailable.</p>
        <Button className="mt-4" onClick={() => setLocation("/")}>Return Home</Button>
      </div>
    );
  }

  if (!currentQuestion) return null;

  const primaryCategory = quizData.categories?.[0];

  return (
    <div className="container max-w-3xl py-8">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="mb-6 flex items-center gap-1.5 text-sm text-muted-foreground flex-wrap">
        <Link href="/" className="inline-flex items-center gap-1 hover:text-foreground transition-colors">
          <Home className="h-3.5 w-3.5" />
          Home
        </Link>
        {primaryCategory && (
          <>
            <ChevronRight className="h-3.5 w-3.5 shrink-0" />
            <Link href={`/category/${primaryCategory.slug}`} className="hover:text-foreground transition-colors">
              {primaryCategory.name}
            </Link>
          </>
        )}
        <ChevronRight className="h-3.5 w-3.5 shrink-0" />
        <span className="text-foreground font-medium truncate max-w-[200px]">{quizData.title}</span>
      </nav>

      {/* Category chips */}
      {quizData.categories && quizData.categories.length > 0 && (
        <div className="mb-6 flex flex-wrap gap-2">
          {quizData.categories.map((cat) => (
            <Link key={cat.id} href={`/category/${cat.slug}`}>
              <Badge variant="secondary" className="cursor-pointer hover:bg-secondary/80 transition-colors">
                {cat.name}
              </Badge>
            </Link>
          ))}
        </div>
      )}

      {/* Header & Progress */}
      <div className="mb-8 space-y-4">
        <div className="flex items-center justify-between text-sm font-medium">
          <span className="text-muted-foreground uppercase tracking-wider">{quizData.title}</span>
          <span className="bg-primary/10 text-primary px-3 py-1 rounded-full">
            Question {currentQuestionIndex + 1} of {questions.length}
          </span>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Main Question Card */}
      <div className="animate-in fade-in slide-in-from-right-4 duration-300" key={currentQuestion.id}>
        <div className="mb-8 flex items-start gap-4">
          <h2 className="flex-1 text-3xl font-serif font-bold text-foreground leading-tight">
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
            
            let buttonClass = "justify-start h-auto min-h-[4rem] text-left p-4 whitespace-normal text-lg border-2 transition-all ";
            
            if (!isAnswered) {
              buttonClass += "hover:border-primary/50 hover:bg-primary/5 bg-card border-card-border shadow-sm";
            } else {
              if (isSelected) {
                buttonClass += "border-primary bg-primary/10 ring-2 ring-primary/30";
              } else {
                buttonClass += "opacity-50 border-card-border bg-card";
              }
            }

            return (
              <Button
                key={index}
                variant="outline"
                className={buttonClass}
                onClick={() => handleSelectOption(index)}
                disabled={isAnswered}
              >
                <div className="flex w-full items-center gap-4">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold">
                    {String.fromCharCode(65 + index)}
                  </span>
                  <span>{option}</span>
                </div>
              </Button>
            );
          })}
        </div>

        {isAnswered && (
          <div className="mt-8 flex justify-end pt-4">
            <Button size="lg" className="w-full sm:w-auto text-lg px-8" onClick={handleNext} disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
              {currentQuestionIndex < questions.length - 1 ? (
                <>Next Question <ArrowRight className="ml-2 h-5 w-5" /></>
              ) : (
                "Complete Journey"
              )}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
