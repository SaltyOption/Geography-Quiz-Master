import { useState, useMemo } from "react";
import { useLocation, useParams } from "wouter";
import { useGetQuiz, useSubmitQuizAttempt, getGetQuizQueryKey } from "@workspace/api-client-react";
import { CheckCircle2, XCircle, ArrowRight, Loader2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent } from "@/components/ui/card";
import mascotThinkingUrl from "@assets/mascot_swallow_thinking.png";

export default function QuizPage() {
  const { id } = useParams();
  const quizId = parseInt(id || "0", 10);
  const [, setLocation] = useLocation();
  
  const { data: quizData, isLoading, error } = useGetQuiz(quizId, {
    query: { enabled: !!quizId, queryKey: getGetQuizQueryKey(quizId) }
  });
  
  const submitQuiz = useSubmitQuizAttempt();

  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [answers, setAnswers] = useState<Array<{questionId: number, selectedOption: number}>>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const questions = quizData?.questions || [];
  const currentQuestion = questions[currentQuestionIndex];
  const progress = questions.length > 0 ? ((currentQuestionIndex) / questions.length) * 100 : 0;

  const isCorrect = isAnswered && currentQuestion && selectedOption === currentQuestion.correctOption;

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
      // Store result in sessionStorage for the results page since we can't easily pass complex state via wouter
      sessionStorage.setItem(`quiz_result_${quizId}`, JSON.stringify(result));
      setLocation(`/quiz/${quizId}/results`);
    } catch (err) {
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

  return (
    <div className="container max-w-3xl py-8">
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
            const isActuallyCorrect = index === currentQuestion.correctOption;
            
            let buttonClass = "justify-start h-auto min-h-[4rem] text-left p-4 whitespace-normal text-lg border-2 transition-all ";
            
            if (!isAnswered) {
              buttonClass += "hover:border-primary/50 hover:bg-primary/5 bg-card border-card-border shadow-sm";
            } else {
              if (isActuallyCorrect) {
                buttonClass += "border-green-500 bg-green-500/10 text-green-900 dark:text-green-300 ring-2 ring-green-500/30";
              } else if (isSelected && !isActuallyCorrect) {
                buttonClass += "border-destructive bg-destructive/10 text-destructive ring-2 ring-destructive/30";
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
                <div className="flex w-full items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold">
                      {String.fromCharCode(65 + index)}
                    </span>
                    <span>{option}</span>
                  </div>
                  {isAnswered && isActuallyCorrect && <CheckCircle2 className="h-6 w-6 shrink-0 text-green-500" />}
                  {isAnswered && isSelected && !isActuallyCorrect && <XCircle className="h-6 w-6 shrink-0 text-destructive" />}
                </div>
              </Button>
            );
          })}
        </div>

        {/* Explanation area */}
        {isAnswered && (
          <div className="mt-8 animate-in slide-in-from-bottom-4 fade-in duration-300 space-y-4">
            <Card className={isCorrect ? "border-green-200 bg-green-50/50 dark:border-green-900/30 dark:bg-green-900/10" : "border-red-200 bg-red-50/50 dark:border-red-900/30 dark:bg-red-900/10"}>
              <CardContent className="p-6">
                <h3 className={`text-lg font-bold mb-2 flex items-center gap-2 ${isCorrect ? "text-green-700 dark:text-green-400" : "text-destructive"}`}>
                  {isCorrect ? (
                    <><CheckCircle2 className="h-5 w-5" /> Excellent!</>
                  ) : (
                    <><XCircle className="h-5 w-5" /> Not quite.</>
                  )}
                </h3>
                <p className="text-foreground leading-relaxed">{currentQuestion.explanation}</p>
                
                {currentQuestion.funFact && (
                  <div className="mt-4 rounded-lg bg-primary/5 p-4 border border-primary/10">
                    <h4 className="flex items-center gap-2 font-bold text-primary mb-1 text-sm uppercase tracking-wider">
                      <MapPin className="h-4 w-4" /> Fun Fact
                    </h4>
                    <p className="text-sm text-muted-foreground">{currentQuestion.funFact}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="flex justify-end pt-4">
              <Button size="lg" className="w-full sm:w-auto text-lg px-8" onClick={handleNext} disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-5 w-5 animate-spin" />}
                {currentQuestionIndex < questions.length - 1 ? (
                  <>Next Question <ArrowRight className="ml-2 h-5 w-5" /></>
                ) : (
                  "Complete Journey"
                )}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
