import { useEffect, useState } from "react";
import { useParams, Link } from "wouter";
import { useGetQuiz, getGetQuizQueryKey, QuizAttemptResult } from "@workspace/api-client-react";
import { CheckCircle2, XCircle, RotateCcw, Home, Award, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { SignUpResultsPrompt } from "@/components/SignUpResultsPrompt";

export default function QuizResultsPage() {
  const { id } = useParams();
  const quizId = parseInt(id || "0", 10);
  const [result, setResult] = useState<QuizAttemptResult | null>(null);

  const { data: quizData, isLoading } = useGetQuiz(quizId, {
    query: { enabled: !!quizId, queryKey: getGetQuizQueryKey(quizId) }
  });

  useEffect(() => {
    const stored = sessionStorage.getItem(`quiz_result_${quizId}`);
    if (stored) {
      setResult(JSON.parse(stored));
    }
  }, [quizId]);

  if (isLoading || !result) {
    return (
      <div className="flex h-[calc(100vh-4rem)] items-center justify-center">
        {!result && !isLoading ? (
          <div className="text-center">
            <h2 className="text-2xl font-bold mb-4">No results found</h2>
            <Button asChild><Link href="/">Return Home</Link></Button>
          </div>
        ) : (
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        )}
      </div>
    );
  }

  const isPerfect = result.score === result.totalQuestions;
  const isGood = result.percentage >= 70;

  return (
    <div className="container max-w-4xl py-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-10 text-center">
        <div className="inline-flex h-20 w-20 items-center justify-center rounded-full bg-primary/10 text-primary mb-6">
          <Award className="h-10 w-10" />
        </div>
        <h1 className="text-4xl font-serif font-bold text-foreground mb-4">
          {isPerfect ? "Flawless Journey!" : isGood ? "Great Exploring!" : "Journey Complete"}
        </h1>
        <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
          You completed the {quizData?.title || "Geography"} adventure. 
          Let's see how well you know this part of the world.
        </p>
      </div>

      <Card className="mb-10 border-primary/20 bg-primary/5 overflow-hidden">
        <div className="bg-primary/10 p-6 flex flex-col items-center justify-center border-b border-primary/10">
          <div className="text-6xl font-bold text-primary mb-2 tracking-tighter">
            {result.score} <span className="text-3xl text-primary/50">/ {result.totalQuestions}</span>
          </div>
          <div className="text-primary/80 font-medium uppercase tracking-wider text-sm">Correct Answers</div>
        </div>
        <CardContent className="p-8">
          <div className="flex items-center gap-4 mb-2">
            <span className="font-bold">{result.percentage}%</span>
            <Progress value={result.percentage} className="flex-1 h-3" />
          </div>
          <div className="flex flex-col sm:flex-row gap-4 justify-center mt-8">
            <Button asChild size="lg" className="px-8">
              <Link href={`/quiz/${quizId}`}>
                <RotateCcw className="mr-2 h-5 w-5" /> Try Again
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/">
                <Home className="mr-2 h-5 w-5" /> More Quizzes
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>

      <SignUpResultsPrompt />

      <h2 className="text-2xl font-serif font-bold mb-6">Your Adventure Log</h2>
      
      <div className="space-y-6">
        {result.questionResults.map((qr, i) => {
          const question = quizData?.questions.find(q => q.id === qr.questionId);
          if (!question) return null;

          return (
            <Card key={qr.questionId} className={qr.isCorrect ? "border-l-4 border-l-green-500" : "border-l-4 border-l-destructive"}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-4">
                  <CardTitle className="text-lg font-medium leading-relaxed">
                    <span className="text-muted-foreground mr-2">{i + 1}.</span> 
                    {question.text}
                  </CardTitle>
                  {qr.isCorrect ? (
                    <CheckCircle2 className="h-6 w-6 shrink-0 text-green-500" />
                  ) : (
                    <XCircle className="h-6 w-6 shrink-0 text-destructive" />
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="rounded-md bg-muted p-3">
                    <span className="text-xs uppercase tracking-wider text-muted-foreground block mb-1">Your Answer</span>
                    <p className={qr.isCorrect ? "text-green-600 font-medium" : "text-destructive font-medium"}>
                      {question.options[qr.selectedOption]}
                    </p>
                  </div>
                  {!qr.isCorrect && (
                    <div className="rounded-md bg-green-50 dark:bg-green-950/20 border border-green-100 dark:border-green-900/30 p-3">
                      <span className="text-xs uppercase tracking-wider text-green-700 dark:text-green-400 block mb-1">Correct Answer</span>
                      <p className="text-green-700 dark:text-green-300 font-medium">
                        {question.options[qr.correctOption]}
                      </p>
                    </div>
                  )}
                </div>
                
                <div className="text-sm text-muted-foreground border-t pt-4">
                  <strong>Explanation:</strong> {qr.explanation}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
