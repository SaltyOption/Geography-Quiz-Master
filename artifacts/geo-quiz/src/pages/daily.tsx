import { useEffect } from "react";
import { useLocation } from "wouter";
import { useGetDailyQuiz, getGetDailyQuizQueryKey } from "@workspace/api-client-react";
import { Loader2, MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";

function utcDateKey(): string {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export default function DailyQuizPage() {
  const [, setLocation] = useLocation();
  const dateKey = utcDateKey();
  const { data, isLoading, isFetching, error } = useGetDailyQuiz({
    query: {
      queryKey: [...getGetDailyQuizQueryKey(), dateKey],
      staleTime: 0,
      refetchOnMount: "always",
    },
  });

  useEffect(() => {
    if (data?.quizId && data.date === dateKey) {
      setLocation(`/quiz/${data.quizId}`, { replace: true });
    }
  }, [data, dateKey, setLocation]);

  const status = (error as { status?: number } | null)?.status;
  const isNoQuizzes = status === 404;

  if (isLoading || isFetching || (data && data.date === dateKey)) {
    return (
      <div className="flex h-[calc(100vh-4rem)] flex-col items-center justify-center gap-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <MapPin className="h-4 w-4" /> Loading today's quiz...
        </p>
      </div>
    );
  }

  return (
    <div className="container py-10 text-center">
      <h2 className="text-2xl font-bold text-destructive">No daily quiz available</h2>
      <p className="text-muted-foreground mt-2">
        {isNoQuizzes
          ? "There aren't any quizzes yet."
          : "Something went wrong loading today's quiz."}
      </p>
      <Button className="mt-4" onClick={() => setLocation("/")} data-testid="button-daily-return-home">
        Return Home
      </Button>
    </div>
  );
}
