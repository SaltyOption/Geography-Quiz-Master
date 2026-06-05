import { useState } from "react";
import { useLocation } from "wouter";
import {
  useCreateQuiz,
  useImportQuestionsByCategory,
  useGetCategoryTree,
  getListQuizzesQueryKey,
  getGetCategoryTreeQueryKey,
} from "@workspace/api-client-react";
import { flattenCategoryTree } from "@/lib/categoryTree";
import { useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Save, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Link } from "wouter";
import { CategoryMultiSelect } from "@/components/CategoryMultiSelect";
import { CategoryTagCombobox } from "@/components/CategoryTagCombobox";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";

const formSchema = z.object({
  title: z.string().min(3, "Title must be at least 3 characters").max(100),
  description: z.string().min(10, "Description must be at least 10 characters").max(500),
  category: z.string().min(2, "Category is required"),
  difficulty: z.enum(["easy", "medium", "hard"]),
  published: z.boolean(),
});

export default function AdminCreateQuiz() {
  const [, setLocation] = useLocation();
  const createQuiz = useCreateQuiz();
  const importByCategory = useImportQuestionsByCategory();
  const { data: tree } = useGetCategoryTree();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [categoryIds, setCategoryIds] = useState<number[]>([]);
  const [importCategoryId, setImportCategoryId] = useState<number | null>(null);

  const flatTags = tree ? flattenCategoryTree(tree) : [];

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      description: "",
      category: "",
      difficulty: "easy",
      published: false,
    },
  });

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      const quiz = await createQuiz.mutateAsync({ data: { ...values, categoryIds } });

      let imported = 0;
      let importFailed = false;
      if (importCategoryId !== null) {
        try {
          const result = await importByCategory.mutateAsync({
            id: quiz.id,
            data: { categoryId: importCategoryId },
          });
          imported = result.imported;
        } catch {
          importFailed = true;
        }
      }

      queryClient.invalidateQueries({ queryKey: getListQuizzesQueryKey() });
      queryClient.invalidateQueries({ queryKey: getGetCategoryTreeQueryKey() });

      if (importFailed) {
        toast({
          title: "Quiz created, but importing questions failed",
          description: "You can try importing by tag again from the quiz editor.",
          variant: "destructive",
        });
      } else if (importCategoryId !== null) {
        toast({
          title: "Quiz created successfully",
          description:
            imported > 0
              ? `${imported} tagged question${imported === 1 ? "" : "s"} imported.`
              : "No questions are tagged with the selected category yet.",
        });
      } else {
        toast({ title: "Quiz created successfully" });
      }

      setLocation(`/admin/quizzes/${quiz.id}`);
    } catch (error) {
      toast({
        title: "Failed to create quiz",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="container max-w-3xl py-10">
      <Button variant="ghost" asChild className="mb-6 -ml-4 text-muted-foreground">
        <Link href="/admin">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Dashboard
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Create New Quiz</CardTitle>
          <CardDescription>Define the basic details of the quiz. You can add questions later.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Quiz Title</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Capitals of Europe" {...field} />
                    </FormControl>
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
                    <FormControl>
                      <Textarea 
                        placeholder="Describe what this quiz is about..." 
                        className="resize-none h-24"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid sm:grid-cols-2 gap-6">
                <FormField
                  control={form.control}
                  name="category"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Primary Category Label</FormLabel>
                      <FormControl>
                        <Input placeholder="e.g. Europe" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="difficulty"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Difficulty</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select difficulty" />
                          </SelectTrigger>
                        </FormControl>
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
              </div>

              <div className="space-y-2">
                <Label>Categories</Label>
                <CategoryMultiSelect selectedIds={categoryIds} onChange={setCategoryIds} />
                <p className="text-xs text-muted-foreground">
                  Pick one or more categories to organize this quiz in the hierarchy.
                </p>
              </div>

              <FormField
                control={form.control}
                name="published"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel>Publish now</FormLabel>
                      <p className="text-xs text-muted-foreground">
                        Off keeps this quiz as a draft, hidden from visitors. You can publish it
                        anytime.
                      </p>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} />
                    </FormControl>
                  </FormItem>
                )}
              />

              <div className="space-y-2">
                <Label>Pre-fill questions by tag (optional)</Label>
                <CategoryTagCombobox
                  tags={flatTags}
                  value={importCategoryId}
                  onChange={setImportCategoryId}
                  noneLabel="Don't import any questions"
                />
                <p className="text-xs text-muted-foreground">
                  Copies every existing question tagged with the chosen category (and its
                  sub-categories) into this new quiz as editable copies.
                </p>
              </div>

              <div className="flex justify-end gap-4 pt-4 border-t">
                <Button variant="outline" asChild>
                  <Link href="/admin">Cancel</Link>
                </Button>
                <Button
                  type="submit"
                  disabled={createQuiz.isPending || importByCategory.isPending}
                >
                  {createQuiz.isPending || importByCategory.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Create Quiz
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
