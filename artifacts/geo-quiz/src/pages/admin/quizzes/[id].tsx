import { useEffect, useState } from "react";
import { useParams, Link } from "wouter";
import { 
  useGetQuiz, 
  useUpdateQuiz, 
  useDeleteQuestion,
  useUpdateQuestion,
  getGetQuizQueryKey,
  getListQuizzesQueryKey,
  getGetCategoryTreeQueryKey,
  type Question,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Save, Loader2, Plus, GripVertical, Trash2, Tags } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { CategoryMultiSelect } from "@/components/CategoryMultiSelect";

const formSchema = z.object({
  title: z.string().min(3).max(100),
  description: z.string().min(10).max(500),
  category: z.string().min(2),
  difficulty: z.enum(["easy", "medium", "hard"]),
});

export default function AdminEditQuiz() {
  const { id } = useParams();
  const quizId = parseInt(id || "0", 10);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: quiz, isLoading } = useGetQuiz(quizId, {
    query: { enabled: !!quizId, queryKey: getGetQuizQueryKey(quizId) }
  });

  const updateQuiz = useUpdateQuiz();
  const deleteQuestion = useDeleteQuestion();

  const [categoryIds, setCategoryIds] = useState<number[]>([]);
  useEffect(() => {
    if (quiz) {
      setCategoryIds(quiz.categories.map((c) => c.id));
    }
  }, [quiz?.id]);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    values: quiz ? {
      title: quiz.title,
      description: quiz.description,
      category: quiz.category,
      difficulty: quiz.difficulty as any,
    } : undefined
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      await updateQuiz.mutateAsync({ id: quizId, data: { ...values, categoryIds } });
      queryClient.invalidateQueries({ queryKey: getGetQuizQueryKey(quizId) });
      queryClient.invalidateQueries({ queryKey: getListQuizzesQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetCategoryTreeQueryKey() });
      toast({ title: "Quiz details updated" });
    } catch (error) {
      toast({ title: "Failed to update quiz", variant: "destructive" });
    }
  };

  const handleDeleteQuestion = async (questionId: number) => {
    if (!confirm("Delete this question?")) return;
    try {
      await deleteQuestion.mutateAsync({ id: questionId });
      queryClient.invalidateQueries({ queryKey: getGetQuizQueryKey(quizId) });
      toast({ title: "Question deleted" });
    } catch (err) {
      toast({ title: "Failed to delete question", variant: "destructive" });
    }
  };

  if (isLoading) {
    return <div className="flex py-20 justify-center"><Loader2 className="h-8 w-8 animate-spin" /></div>;
  }

  if (!quiz) return <div>Quiz not found</div>;

  return (
    <div className="container max-w-5xl py-10">
      <Button variant="ghost" asChild className="mb-6 -ml-4 text-muted-foreground">
        <Link href="/admin">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
        </Link>
      </Button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Quiz Details</CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <FormField
                    control={form.control}
                    name="title"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Title</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="description"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Description</FormLabel>
                        <FormControl><Textarea className="h-20" {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="category"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Primary Category Label</FormLabel>
                        <FormControl><Input {...field} /></FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <div className="space-y-2">
                    <Label>Categories</Label>
                    <CategoryMultiSelect selectedIds={categoryIds} onChange={setCategoryIds} />
                  </div>
                  <FormField
                    control={form.control}
                    name="difficulty"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Difficulty</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                          <SelectContent>
                            <SelectItem value="easy">Easy</SelectItem>
                            <SelectItem value="medium">Medium</SelectItem>
                            <SelectItem value="hard">Hard</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={updateQuiz.isPending}>
                    {updateQuiz.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                    Save Changes
                  </Button>
                </form>
              </Form>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold">Questions ({quiz.questions?.length || 0})</h2>
            <Button asChild>
              <Link href={`/admin/quizzes/${quizId}/questions/new`}>
                <Plus className="mr-2 h-4 w-4" /> Add Question
              </Link>
            </Button>
          </div>

          {quiz.questions?.length === 0 ? (
            <Card className="flex flex-col items-center justify-center py-12 text-center bg-muted/50 border-dashed">
              <CardDescription className="mb-4">This quiz doesn't have any questions yet.</CardDescription>
              <Button asChild variant="outline">
                <Link href={`/admin/quizzes/${quizId}/questions/new`}>Add First Question</Link>
              </Button>
            </Card>
          ) : (
            <div className="space-y-4">
              {quiz.questions?.map((q, i) => (
                <Card key={q.id} className="relative group">
                  <CardContent className="p-4 flex gap-4">
                    <div className="mt-1 cursor-grab text-muted-foreground/50 hover:text-foreground">
                      <GripVertical className="h-5 w-5" />
                    </div>
                    <div className="flex-1 space-y-2">
                      <div className="flex justify-between items-start gap-4">
                        <h4 className="font-medium text-lg leading-tight">
                          <span className="text-muted-foreground mr-2">{i + 1}.</span>
                          {q.text}
                        </h4>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-8 w-8 text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                          onClick={() => handleDeleteQuestion(q.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2 text-sm mt-3">
                        {q.options.map((opt, idx) => (
                          <div 
                            key={idx} 
                            className={`p-2 rounded border ${idx === q.correctOption ? 'bg-green-50/50 border-green-200 dark:bg-green-900/20 dark:border-green-800' : 'bg-muted/50'}`}
                          >
                            <span className="font-bold mr-2 text-muted-foreground">{String.fromCharCode(65 + idx)}</span>
                            {opt}
                          </div>
                        ))}
                      </div>

                      <QuestionTagsEditor question={q} quizId={quizId} />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function QuestionTagsEditor({ question, quizId }: { question: Question; quizId: number }) {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const updateQuestion = useUpdateQuestion();
  const [open, setOpen] = useState(false);
  const [categoryIds, setCategoryIds] = useState<number[]>([]);

  useEffect(() => {
    if (open) {
      setCategoryIds(question.categories.map((c) => c.id));
    }
  }, [open, question.categories]);

  const handleSave = async () => {
    try {
      await updateQuestion.mutateAsync({ id: question.id, data: { categoryIds } });
      queryClient.invalidateQueries({ queryKey: getGetQuizQueryKey(quizId) });
      queryClient.invalidateQueries({ queryKey: getGetCategoryTreeQueryKey() });
      toast({ title: "Tags updated" });
      setOpen(false);
    } catch {
      toast({ title: "Failed to update tags", variant: "destructive" });
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5 pt-1">
      {question.categories.map((c) => (
        <Badge key={c.id} variant="secondary" className="text-xs">
          {c.name}
        </Badge>
      ))}
      {question.categories.length === 0 && (
        <span className="text-xs text-muted-foreground">No categories tagged</span>
      )}
      <Button
        variant="ghost"
        size="sm"
        className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
        onClick={() => setOpen(true)}
      >
        <Tags className="mr-1 h-3.5 w-3.5" /> Edit tags
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit question tags</DialogTitle>
            <DialogDescription>
              Tag this question with categories so it can be reused in category practice quizzes.
            </DialogDescription>
          </DialogHeader>
          <CategoryMultiSelect selectedIds={categoryIds} onChange={setCategoryIds} />
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={updateQuestion.isPending}>
              {updateQuestion.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-2 h-4 w-4" />
              )}
              Save tags
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
