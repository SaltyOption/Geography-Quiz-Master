import { useEffect, useState } from "react";
import { Link, useParams } from "wouter";
import {
  useGetAdminCourse,
  useUpdateCourseQuestion,
  useUpdateCourse,
  getGetAdminCourseQueryKey,
  type CourseQuestion,
  type UpdateCourseQuestionBody,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Edit2, CheckCircle2, ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ImagePicker } from "@/components/ImagePicker";
import { useToast } from "@/hooks/use-toast";

interface EditState {
  text: string;
  options: string[];
  correctOption: number;
  explanation: string;
  funFact: string;
  learningObjective: string;
  difficulty: string;
  questionType: string;
}

function toEditState(q: CourseQuestion): EditState {
  return {
    text: q.text,
    options: [...q.options],
    correctOption: q.correctOption ?? 0,
    explanation: q.explanation ?? "",
    funFact: q.funFact ?? "",
    learningObjective: q.learningObjective ?? "",
    difficulty: q.difficulty ?? "",
    questionType: q.questionType ?? "",
  };
}

export default function CourseEditor() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;
  const { data: course, isLoading } = useGetAdminCourse(slug);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const updateMutation = useUpdateCourseQuestion();
  const updateCourseMutation = useUpdateCourse();

  const [editing, setEditing] = useState<CourseQuestion | null>(null);
  const [form, setForm] = useState<EditState | null>(null);

  const [imageOpen, setImageOpen] = useState(false);
  const [imageForm, setImageForm] = useState("");

  useEffect(() => {
    if (editing) setForm(toEditState(editing));
    else setForm(null);
  }, [editing]);

  useEffect(() => {
    if (imageOpen) setImageForm(course?.imageUrl ?? "");
  }, [imageOpen, course?.imageUrl]);

  const handleSaveImage = async () => {
    if (!course) return;
    try {
      await updateCourseMutation.mutateAsync({
        slug: course.slug,
        data: { imageUrl: imageForm.trim() === "" ? null : imageForm.trim() },
      });
      await queryClient.invalidateQueries({ queryKey: getGetAdminCourseQueryKey(slug) });
      toast({ title: "Course image updated" });
      setImageOpen(false);
    } catch (err) {
      toast({
        title: "Failed to update image",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    }
  };

  const handleSave = async () => {
    if (!editing || !form) return;
    const trimmedOptions = form.options.map((o) => o.trim());
    if (form.text.trim().length === 0) {
      toast({ title: "Question text is required", variant: "destructive" });
      return;
    }
    if (trimmedOptions.some((o) => o.length === 0)) {
      toast({ title: "All options must be filled in", variant: "destructive" });
      return;
    }
    if (form.correctOption < 0 || form.correctOption >= trimmedOptions.length) {
      toast({ title: "Select a correct answer", variant: "destructive" });
      return;
    }

    const body: UpdateCourseQuestionBody = {
      text: form.text.trim(),
      options: trimmedOptions,
      correctOption: form.correctOption,
      explanation: form.explanation.trim(),
      funFact: form.funFact.trim() === "" ? null : form.funFact.trim(),
      learningObjective:
        form.learningObjective.trim() === "" ? null : form.learningObjective.trim(),
      difficulty: form.difficulty.trim() === "" ? null : form.difficulty.trim(),
      questionType: form.questionType.trim() === "" ? null : form.questionType.trim(),
    };

    try {
      await updateMutation.mutateAsync({ id: editing.id, data: body });
      await queryClient.invalidateQueries({ queryKey: getGetAdminCourseQueryKey(slug) });
      toast({ title: "Question updated" });
      setEditing(null);
    } catch {
      toast({ title: "Failed to update question", variant: "destructive" });
    }
  };

  return (
    <div className="container max-w-5xl py-10">
      <Button variant="ghost" size="sm" asChild className="mb-2 -ml-2">
        <Link href="/admin/courses">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Courses
        </Link>
      </Button>

      {isLoading ? (
        <div className="flex py-20 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !course ? (
        <Card className="py-20 text-center">
          <CardHeader>
            <CardTitle>Course not found</CardTitle>
            <CardDescription>This course may have been deleted.</CardDescription>
          </CardHeader>
        </Card>
      ) : (
        <>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{course.title}</h1>
              {course.description && (
                <p className="text-muted-foreground mt-1">{course.description}</p>
              )}
            </div>
            <Button variant="outline" size="sm" onClick={() => setImageOpen(true)}>
              <ImageIcon className="mr-2 h-4 w-4" />
              {course.imageUrl ? "Edit image" : "Add image"}
            </Button>
          </div>
          {course.imageUrl && (
            <p className="text-muted-foreground mt-2 font-mono text-xs break-all">
              {course.imageUrl}
            </p>
          )}

          <div className="mt-8 space-y-6">
            {course.modules.length === 0 && (
              <p className="text-muted-foreground">This course has no modules.</p>
            )}
            {course.modules.map((mod) => (
              <Card key={mod.id}>
                <CardHeader>
                  <CardTitle className="text-xl">{mod.title}</CardTitle>
                  {mod.description && (
                    <CardDescription>{mod.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  {mod.lessons.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No lessons.</p>
                  ) : (
                    <Accordion type="multiple" className="w-full">
                      {mod.lessons.map((lesson) => (
                        <AccordionItem key={lesson.id} value={`lesson-${lesson.id}`}>
                          <AccordionTrigger>
                            <span className="flex items-center gap-2">
                              {lesson.title}
                              <Badge variant="secondary">
                                {lesson.questions.length} questions
                              </Badge>
                            </span>
                          </AccordionTrigger>
                          <AccordionContent>
                            <div className="space-y-3">
                              {lesson.questions.length === 0 && (
                                <p className="text-muted-foreground text-sm">
                                  No questions.
                                </p>
                              )}
                              {lesson.questions.map((q, idx) => (
                                <div
                                  key={q.id}
                                  className="rounded-lg border p-4 flex items-start justify-between gap-4"
                                >
                                  <div className="flex-1 min-w-0">
                                    <p className="font-medium">
                                      {idx + 1}. {q.text}
                                    </p>
                                    <ul className="mt-2 space-y-1 text-sm">
                                      {q.options.map((opt, i) => (
                                        <li
                                          key={i}
                                          className={
                                            i === q.correctOption
                                              ? "text-green-600 dark:text-green-400 flex items-center gap-1"
                                              : "text-muted-foreground"
                                          }
                                        >
                                          {i === q.correctOption && (
                                            <CheckCircle2 className="h-3.5 w-3.5" />
                                          )}
                                          {opt}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => setEditing(q)}
                                  >
                                    <Edit2 className="mr-2 h-4 w-4" /> Edit
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      ))}
                    </Accordion>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}

      <Dialog open={editing !== null} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Question</DialogTitle>
            <DialogDescription>
              Update this learning module question. Changes save immediately.
            </DialogDescription>
          </DialogHeader>

          {form && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="q-text">Question</Label>
                <Textarea
                  id="q-text"
                  value={form.text}
                  onChange={(e) => setForm({ ...form, text: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label>Options (select the correct answer)</Label>
                <RadioGroup
                  value={String(form.correctOption)}
                  onValueChange={(v) => setForm({ ...form, correctOption: Number(v) })}
                  className="space-y-2"
                >
                  {form.options.map((opt, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <RadioGroupItem value={String(i)} id={`opt-${i}`} />
                      <Input
                        value={opt}
                        onChange={(e) => {
                          const next = [...form.options];
                          next[i] = e.target.value;
                          setForm({ ...form, options: next });
                        }}
                      />
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label htmlFor="q-explanation">Explanation</Label>
                <Textarea
                  id="q-explanation"
                  value={form.explanation}
                  onChange={(e) => setForm({ ...form, explanation: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="q-funfact">Fun fact (optional)</Label>
                <Textarea
                  id="q-funfact"
                  value={form.funFact}
                  onChange={(e) => setForm({ ...form, funFact: e.target.value })}
                  rows={2}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="q-objective">Learning objective (optional)</Label>
                <Input
                  id="q-objective"
                  value={form.learningObjective}
                  onChange={(e) =>
                    setForm({ ...form, learningObjective: e.target.value })
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="q-difficulty">Difficulty (optional)</Label>
                  <Input
                    id="q-difficulty"
                    value={form.difficulty}
                    onChange={(e) => setForm({ ...form, difficulty: e.target.value })}
                    placeholder="Easy / Medium / Hard"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="q-type">Question type (optional)</Label>
                  <Input
                    id="q-type"
                    value={form.questionType}
                    onChange={(e) => setForm({ ...form, questionType: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={imageOpen} onOpenChange={setImageOpen}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Course image</DialogTitle>
            <DialogDescription>
              Set a hosted image URL for this course. Leave blank to remove it.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Choose from hosted images</Label>
              <ImagePicker value={imageForm} onSelect={setImageForm} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="course-image">Or enter an image URL</Label>
              <Input
                id="course-image"
                placeholder="/landmarks/pyramids-giza.jpg"
                value={imageForm}
                onChange={(e) => setImageForm(e.target.value)}
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                Hosted images under /regions/ or /landmarks/ must have their responsive variants
                uploaded, or saving is rejected.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setImageOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveImage} disabled={updateCourseMutation.isPending}>
              {updateCourseMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Save image
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
