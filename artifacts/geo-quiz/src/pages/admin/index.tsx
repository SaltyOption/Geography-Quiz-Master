import { useState } from "react";
import { Link, useLocation } from "wouter";
import {
  useListQuizzes,
  useDeleteQuiz,
  getListQuizzesQueryKey,
  exportQuizzes,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Edit2,
  Trash2,
  Loader2,
  BarChart2,
  FolderTree,
  Upload,
  Download,
  GraduationCap,
} from "lucide-react";
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
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const data = await exportQuizzes();
      const json = JSON.stringify(data, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `quizzes-export-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      const skipped = data.skippedEmptyQuizzes ?? [];
      const skippedNote =
        skipped.length > 0
          ? ` Skipped ${skipped.length} empty quiz${skipped.length === 1 ? "" : "es"}: ${skipped.join(", ")}.`
          : "";
      toast({
        title: "Export downloaded",
        description: `${data.items.length} questions across ${
          new Set(data.items.map((i) => i.topic)).size
        } quizzes.${skippedNote}`,
      });
    } catch (error) {
      const message =
        error instanceof Error && error.message
          ? error.message
          : "Could not download the export file.";
      toast({
        title: "Export failed",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsExporting(false);
    }
  };

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
        <div className="flex items-center gap-2">
          <Button variant="outline" asChild>
            <Link href="/admin/categories">
              <FolderTree className="mr-2 h-4 w-4" /> Manage Categories
            </Link>
          </Button>
          <Button
            variant="outline"
            onClick={handleExport}
            disabled={isExporting || !quizzes || quizzes.length === 0}
            data-testid="button-export-quizzes"
          >
            {isExporting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Download className="mr-2 h-4 w-4" />
            )}
            Download All
          </Button>
          <Button variant="outline" asChild data-testid="link-bulk-import">
            <Link href="/admin/import">
              <Upload className="mr-2 h-4 w-4" /> Bulk Import
            </Link>
          </Button>
          <Button variant="outline" asChild data-testid="link-courses-import">
            <Link href="/admin/courses-import">
              <GraduationCap className="mr-2 h-4 w-4" /> Courses Import
            </Link>
          </Button>
          <Button asChild>
            <Link href="/admin/quizzes/new">
              <Plus className="mr-2 h-4 w-4" /> Create Quiz
            </Link>
          </Button>
        </div>
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
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <h2 className="text-xl font-bold">{quiz.title}</h2>
                  <Badge variant={
                    quiz.difficulty === 'hard' ? 'destructive' :
                    quiz.difficulty === 'medium' ? 'default' : 'secondary'
                  }>
                    {quiz.difficulty}
                  </Badge>
                  {quiz.categories.length > 0 ? (
                    quiz.categories.map((c) => (
                      <Badge key={c.id} variant="outline">{c.name}</Badge>
                    ))
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">Uncategorized</Badge>
                  )}
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
