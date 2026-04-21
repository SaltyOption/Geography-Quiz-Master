import { useListQuizzes, useGetUserProgress } from "@workspace/api-client-react";
import { Link } from "wouter";
import { MapPin, Globe2, Loader2, Play, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Show } from "@clerk/react";

export default function Home() {
  const { data: quizzes, isLoading, error } = useListQuizzes();
  const { data: progress } = useGetUserProgress();

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
          <h2 className="mb-2 font-semibold">Failed to load quizzes</h2>
          <p>Please check your connection and try again.</p>
        </div>
      </div>
    );
  }

  const getQuizProgress = (quizId: number) => {
    if (!progress || !progress.recentAttempts) return null;
    const attempts = progress.recentAttempts.filter(a => a.quizId === quizId);
    if (attempts.length === 0) return null;
    const bestAttempt = attempts.reduce((prev, current) => (prev.score > current.score) ? prev : current);
    return bestAttempt;
  };

  return (
    <div className="container max-w-6xl py-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-10 flex flex-col gap-4 text-center md:mb-16 md:flex-row md:items-center md:justify-between md:text-left">
        <div>
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl lg:text-7xl">
            Explore the <span className="text-primary">World</span>
          </h1>
          <p className="mt-4 max-w-[42rem] text-lg text-muted-foreground sm:text-xl">
            Embark on a journey through continents, cultures, and landscapes. Test your geographical knowledge and discover fascinating new places.
          </p>
        </div>
        <div className="flex justify-center md:justify-end">
          <Globe2 className="h-24 w-24 text-primary/20 md:h-32 md:w-32" />
        </div>
      </div>

      {quizzes?.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed p-12 text-center">
          <MapPin className="mb-4 h-12 w-12 text-muted-foreground/50" />
          <h2 className="text-xl font-semibold">No Quizzes Available</h2>
          <p className="mt-2 text-muted-foreground">The world is empty! Head to the admin panel to create some quizzes.</p>
          <Button asChild className="mt-6">
            <Link href="/admin">Go to Admin Dashboard</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {quizzes?.map((quiz, i) => {
            const quizProgress = getQuizProgress(quiz.id);
            return (
              <Card 
                key={quiz.id} 
                className="group flex flex-col overflow-hidden transition-all hover:shadow-md hover:border-primary/50 relative"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <CardHeader>
                  <div className="mb-2 flex items-center justify-between">
                    <Badge variant={
                      quiz.difficulty === 'hard' ? 'destructive' :
                      quiz.difficulty === 'medium' ? 'default' : 'secondary'
                    }>
                      {quiz.difficulty.charAt(0).toUpperCase() + quiz.difficulty.slice(1)}
                    </Badge>
                    <span className="text-xs font-medium text-muted-foreground">
                      {quiz.questionCount} {quiz.questionCount === 1 ? 'Question' : 'Questions'}
                    </span>
                  </div>
                  <CardTitle className="text-xl group-hover:text-primary transition-colors pr-8">
                    {quiz.title}
                  </CardTitle>
                  <CardDescription className="line-clamp-2">
                    {quiz.description}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex-1">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="bg-muted">
                      {quiz.category}
                    </Badge>
                    <Show when="signed-in">
                      {quizProgress && (
                        <div className="flex items-center text-sm font-medium text-primary bg-primary/10 px-2 py-1 rounded-md">
                          <CheckCircle2 className="w-4 h-4 mr-1" />
                          {Math.round(quizProgress.percentage)}% Best
                        </div>
                      )}
                    </Show>
                  </div>
                </CardContent>
                <CardFooter className="pt-4 border-t bg-muted/20">
                  <Button className="w-full" variant={quizProgress ? "secondary" : "default"} asChild>
                    <Link href={`/quiz/${quiz.id}`}>
                      <Play className="mr-2 h-4 w-4" /> {quizProgress ? "Retake Adventure" : "Start Adventure"}
                    </Link>
                  </Button>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
