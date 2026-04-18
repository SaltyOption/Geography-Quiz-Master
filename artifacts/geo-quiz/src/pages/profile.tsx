import { useGetUserProgress } from "@workspace/api-client-react";
import { Loader2, Award, Target, Hash, RefreshCcw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { format } from "date-fns";

export default function UserProfilePage() {
  const { data: progress, isLoading, error } = useGetUserProgress();

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
          <h2 className="mb-2 font-semibold">Failed to load profile</h2>
          <p>Please check your connection and try again.</p>
        </div>
      </div>
    );
  }

  const hasAttempts = progress && progress.totalAttempts > 0;

  return (
    <div className="container max-w-4xl py-10 animate-in fade-in duration-500">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Your Explorer Profile</h1>
        <p className="text-muted-foreground mt-2">Track your progress and geographical mastery.</p>
      </div>

      {!hasAttempts ? (
        <Card className="border-dashed border-2 bg-muted/20">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Target className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-xl font-bold mb-2">No adventures yet</h3>
            <p className="text-muted-foreground mb-6 max-w-md">
              You haven't taken any quizzes yet. Start exploring the world to earn scores and track your progress here!
            </p>
            <Button asChild>
              <Link href="/">Explore Quizzes</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium">Quizzes Taken</CardTitle>
                <Hash className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{progress.totalQuizzesTaken}</div>
                <p className="text-xs text-muted-foreground mt-1">
                  Across {progress.totalAttempts} total attempts
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium">Average Score</CardTitle>
                <Target className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{Math.round(progress.averagePercentage)}%</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
                <CardTitle className="text-sm font-medium">Best Score</CardTitle>
                <Award className="h-4 w-4 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{Math.round(progress.bestPercentage)}%</div>
              </CardContent>
            </Card>
          </div>

          <div>
            <h2 className="text-2xl font-semibold mb-4 tracking-tight">Recent Attempts</h2>
            <div className="grid gap-4">
              {progress.recentAttempts.map((attempt) => (
                <Card key={attempt.id} className="overflow-hidden">
                  <div className="flex flex-col md:flex-row md:items-center p-6 gap-4">
                    <div className="flex-1 space-y-1">
                      <h3 className="font-semibold text-lg leading-none">{attempt.quizTitle}</h3>
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(attempt.completedAt), "MMM d, yyyy 'at' h:mm a")}
                      </p>
                    </div>
                    
                    <div className="flex items-center gap-6">
                      <div className="text-right">
                        <div className="text-2xl font-bold text-primary">{Math.round(attempt.percentage)}%</div>
                        <div className="text-sm text-muted-foreground">{attempt.score} / {attempt.totalQuestions} correct</div>
                      </div>
                      
                      <Button variant="outline" size="sm" asChild className="hidden md:flex">
                        <Link href={`/quiz/${attempt.quizId}`}>
                          <RefreshCcw className="h-4 w-4 mr-2" /> Retake
                        </Link>
                      </Button>
                    </div>
                    
                    <Button variant="outline" size="sm" asChild className="w-full md:hidden mt-2">
                      <Link href={`/quiz/${attempt.quizId}`}>
                        <RefreshCcw className="h-4 w-4 mr-2" /> Retake
                      </Link>
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
