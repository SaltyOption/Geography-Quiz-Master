import { Link, useLocation } from "wouter";
import { useListQuizzes, useDeleteQuiz, getListQuizzesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Plus, Edit2, Trash2, Loader2, BarChart2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";

export default function AdminDashboard() {
  const { data: quizzes, isLoading } = useListQuizzes();
  const deleteQuiz = useDeleteQuiz();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const handleDelete = async (id: number) => {
    try {
      await deleteQuiz.mutateAsync({ id });
      queryClient.invalidateQueries({ queryKey: getListQuizzesQueryKey() });
      toast({
        title: "Quiz deleted",
        description: "The quiz and all its questions have been removed.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete the quiz.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="container max-w-6xl py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
          <p className="text-muted-foreground mt-1">Manage quizzes, questions, and content.</p>
        </div>
        <Button asChild>
          <Link href="/admin/quizzes/new">
            <Plus className="mr-2 h-4 w-4" /> Create Quiz
          </Link>
        </Button>
      </div>

      {isLoading ? (
        <div className="flex py-20 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : quizzes?.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-20 text-center">
          <CardHeader>
            <CardTitle>No quizzes yet</CardTitle>
            <CardDescription>Get started by creating your first quiz.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild>
              <Link href="/admin/quizzes/new">Create Quiz</Link>
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6">
          {quizzes?.map((quiz) => (
            <Card key={quiz.id} className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-6">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h2 className="text-xl font-bold">{quiz.title}</h2>
                  <Badge variant="outline">{quiz.category}</Badge>
                  <Badge variant={
                    quiz.difficulty === 'hard' ? 'destructive' :
                    quiz.difficulty === 'medium' ? 'default' : 'secondary'
                  }>
                    {quiz.difficulty}
                  </Badge>
                </div>
                <p className="text-muted-foreground line-clamp-1 max-w-2xl mb-2">{quiz.description}</p>
                <div className="flex items-center gap-4 text-sm text-muted-foreground font-medium">
                  <span className="flex items-center gap-1"><BarChart2 className="h-4 w-4" /> {quiz.questionCount} Questions</span>
                  <span>Created {new Date(quiz.createdAt).toLocaleDateString()}</span>
                </div>
              </div>
              
              <div className="flex items-center gap-2 mt-4 sm:mt-0">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/admin/quizzes/${quiz.id}`}>
                    <Edit2 className="mr-2 h-4 w-4" /> Edit
                  </Link>
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" size="sm">
                      <Trash2 className="mr-2 h-4 w-4" /> Delete
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                      <AlertDialogDescription>
                        This will permanently delete the quiz "{quiz.title}" and all its questions. This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleDelete(quiz.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
