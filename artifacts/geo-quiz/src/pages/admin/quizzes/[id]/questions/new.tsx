import { useState } from "react";
import { useParams, Link, useLocation } from "wouter";
import { useCreateQuestion, getGetQuizQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useForm, useFieldArray } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, Save, Loader2, Check, Wand2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { CategoryMultiSelect } from "@/components/CategoryMultiSelect";
import { COUNTRIES, flagUrl, outlineUrl, pickRandomDistractors } from "@/lib/countries";

const formSchema = z.object({
  text: z.string().min(5, "Question text is required"),
  options: z.array(z.object({ value: z.string().min(1, "Option text is required") })).length(4),
  correctOption: z.number().min(0).max(3),
  explanation: z.string().min(5, "Explanation is required"),
  funFact: z.string().optional(),
  imageUrl: z.string().url().optional().or(z.literal("")),
});

export default function AdminCreateQuestion() {
  const { id } = useParams();
  const quizId = parseInt(id || "0", 10);
  const [, setLocation] = useLocation();
  const createQuestion = useCreateQuestion();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      text: "",
      options: [{ value: "" }, { value: "" }, { value: "" }, { value: "" }],
      correctOption: 0,
      explanation: "",
      funFact: "",
      imageUrl: "",
    },
  });

  const { fields } = useFieldArray({
    control: form.control,
    name: "options",
  });

  const [quickType, setQuickType] = useState<"flag" | "outline">("flag");
  const [quickCountry, setQuickCountry] = useState<string>("");
  const [categoryIds, setCategoryIds] = useState<number[]>([]);

  const handleQuickFill = () => {
    const country = COUNTRIES.find((c) => c.code === quickCountry);
    if (!country) return;

    const distractors = pickRandomDistractors(country.code, 3);
    const correctIndex = Math.floor(Math.random() * 4);
    const options = [...distractors.map((d) => d.name)];
    options.splice(correctIndex, 0, country.name);

    if (quickType === "flag") {
      form.setValue("text", "Which country's flag is this?");
      form.setValue("imageUrl", flagUrl(country.code));
      form.setValue(
        "explanation",
        `This is the national flag of ${country.name}.`,
      );
    } else {
      form.setValue("text", "Which country has this outline?");
      form.setValue("imageUrl", outlineUrl(country.code));
      form.setValue(
        "explanation",
        `This is the outline of ${country.name}.`,
      );
    }
    form.setValue(
      "options",
      options.map((value) => ({ value })),
    );
    form.setValue("correctOption", correctIndex);
    form.setValue("funFact", "");
    toast({
      title: "Question pre-filled",
      description: `Edit the explanation and fun fact, then save.`,
    });
  };

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    try {
      const formattedValues = {
        ...values,
        options: values.options.map(o => o.value),
        orderIndex: 0, // In a real app we'd get max order index, for now server handles or defaults
        funFact: values.funFact || null,
        imageUrl: values.imageUrl || null,
        categoryIds,
      };

      await createQuestion.mutateAsync({ 
        id: quizId, 
        data: formattedValues 
      });
      
      queryClient.invalidateQueries({ queryKey: getGetQuizQueryKey(quizId) });
      toast({ title: "Question added successfully" });
      setLocation(`/admin/quizzes/${quizId}`);
    } catch (error) {
      toast({ title: "Failed to add question", variant: "destructive" });
    }
  };

  return (
    <div className="container max-w-3xl py-10">
      <Button variant="ghost" asChild className="mb-6 -ml-4 text-muted-foreground">
        <Link href={`/admin/quizzes/${quizId}`}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Quiz
        </Link>
      </Button>

      <Card className="mb-6 border-primary/30 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Wand2 className="h-5 w-5 text-primary" /> Quick fill from a country
          </CardTitle>
          <CardDescription>
            Generate a flag or outline question instantly. The correct answer position and three distractors are randomised.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1">
              <Label className="mb-2 block text-sm font-medium">Type</Label>
              <Select value={quickType} onValueChange={(v) => setQuickType(v as "flag" | "outline")}>
                <SelectTrigger data-testid="select-quick-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="flag">Flag</SelectItem>
                  <SelectItem value="outline">Country outline</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label className="mb-2 block text-sm font-medium">Country</Label>
              <Select value={quickCountry} onValueChange={setQuickCountry}>
                <SelectTrigger data-testid="select-quick-country">
                  <SelectValue placeholder="Pick a country..." />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  {COUNTRIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              type="button"
              onClick={handleQuickFill}
              disabled={!quickCountry}
              data-testid="button-quick-fill"
            >
              <Wand2 className="mr-2 h-4 w-4" /> Fill form
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Add Question</CardTitle>
          <CardDescription>Create a new multiple choice question for this quiz.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
              <FormField
                control={form.control}
                name="text"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-base font-bold">Question Text</FormLabel>
                    <FormControl>
                      <Textarea placeholder="e.g. Which of these rivers is the longest?" className="text-lg min-h-[100px]" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="space-y-4 bg-muted/30 p-6 rounded-xl border">
                <Label className="text-base font-bold mb-4 block">Answer Options & Correct Answer</Label>
                
                <FormField
                  control={form.control}
                  name="correctOption"
                  render={({ field }) => (
                    <FormItem>
                      <FormControl>
                        <RadioGroup
                          onValueChange={(val) => field.onChange(parseInt(val, 10))}
                          defaultValue={field.value.toString()}
                          className="space-y-3"
                        >
                          {fields.map((optionField, index) => (
                            <div key={optionField.id} className="flex items-center gap-3">
                              <FormItem className="flex items-center space-y-0 relative">
                                <FormControl>
                                  <RadioGroupItem value={index.toString()} className="sr-only peer" />
                                </FormControl>
                                <div className="h-6 w-6 rounded-full border-2 border-primary flex items-center justify-center peer-data-[state=checked]:bg-primary peer-data-[state=checked]:text-primary-foreground cursor-pointer transition-colors">
                                  {field.value === index && <Check className="h-3 w-3" />}
                                </div>
                              </FormItem>
                              
                              <div className="flex-1">
                                <FormField
                                  control={form.control}
                                  name={`options.${index}.value`}
                                  render={({ field: inputField }) => (
                                    <FormItem>
                                      <FormControl>
                                        <Input 
                                          placeholder={`Option ${String.fromCharCode(65 + index)}`} 
                                          className={field.value === index ? "border-primary ring-1 ring-primary" : ""}
                                          {...inputField} 
                                        />
                                      </FormControl>
                                      <FormMessage />
                                    </FormItem>
                                  )}
                                />
                              </div>
                            </div>
                          ))}
                        </RadioGroup>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="space-y-6">
                <FormField
                  control={form.control}
                  name="explanation"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bold">Explanation</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Explain why the correct answer is right..." className="h-24" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="funFact"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bold">Fun Fact (Optional)</FormLabel>
                      <FormControl>
                        <Textarea placeholder="Add an interesting related fact..." className="h-20" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="imageUrl"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="font-bold">Image URL (Optional)</FormLabel>
                      <FormControl>
                        <Input placeholder="https://example.com/image.jpg" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="space-y-2">
                  <Label className="font-bold">Categories (Optional)</Label>
                  <p className="text-sm text-muted-foreground">
                    Tag this question so it can be imported into other quizzes by tag.
                  </p>
                  <CategoryMultiSelect selectedIds={categoryIds} onChange={setCategoryIds} />
                </div>
              </div>

              <div className="flex justify-end gap-4 pt-4 border-t">
                <Button variant="outline" asChild>
                  <Link href={`/admin/quizzes/${quizId}`}>Cancel</Link>
                </Button>
                <Button type="submit" disabled={createQuestion.isPending}>
                  {createQuestion.isPending ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="mr-2 h-4 w-4" />
                  )}
                  Save Question
                </Button>
              </div>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
