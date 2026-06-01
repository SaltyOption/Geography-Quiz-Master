import { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  useBulkImportQuizzes,
  useListCategories,
  useListQuizzes,
  getListQuizzesQueryKey,
  getGetCategoryTreeQueryKey,
  type BulkImportItem,
  type BulkImportResult,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  Upload,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileJson,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

interface ParseResult {
  ok: boolean;
  items?: BulkImportItem[];
  error?: string;
  warnings: string[];
}

type AnyRec = Record<string, unknown>;

// Case-insensitive lookup that also accepts a few common aliases for each canonical key.
const FIELD_ALIASES: Record<string, string[]> = {
  topic: ["topic", "category", "quiz", "quiz_title", "quiztitle", "title", "subject"],
  question: ["question", "question_text", "questiontext", "prompt", "text", "q"],
  options: ["options", "choices", "answers", "answer_choices"],
  correct_answer: [
    "correct_answer",
    "correctanswer",
    "answer",
    "correct",
    "correct_option",
    "correctoption",
  ],
  explanation: ["explanation", "explain", "rationale", "reason", "details"],
  fun_fact: ["fun_fact", "funfact", "trivia", "did_you_know", "didyouknow"],
  difficulty: ["difficulty", "level"],
  image_url: ["image_url", "imageurl", "image", "img", "img_url", "picture", "photo"],
  categories: ["categories", "tags", "category_tags", "categorytags", "labels"],
};

// Normalize a categories value that may be an array of strings or a comma-separated string.
function normalizeCategories(raw: unknown): string[] | undefined {
  let arr: unknown[];
  if (Array.isArray(raw)) {
    arr = raw;
  } else if (typeof raw === "string") {
    arr = raw.split(",");
  } else {
    return undefined;
  }
  const names = arr
    .map((v) => String(v ?? "").trim())
    .filter((v) => v.length > 0);
  return names.length > 0 ? Array.from(new Set(names)) : undefined;
}

function pick(obj: AnyRec, key: keyof typeof FIELD_ALIASES): unknown {
  const lowerMap: AnyRec = {};
  for (const [k, v] of Object.entries(obj)) lowerMap[k.toLowerCase()] = v;
  for (const alias of FIELD_ALIASES[key]) {
    if (alias in lowerMap) return lowerMap[alias];
  }
  return undefined;
}

// Normalize options that may be either {A,B,C,D} or an array, with case-insensitive keys.
function normalizeOptions(raw: unknown): { A: string; B: string; C: string; D: string } | null {
  if (Array.isArray(raw) && raw.length >= 4) {
    return {
      A: String(raw[0] ?? "").trim(),
      B: String(raw[1] ?? "").trim(),
      C: String(raw[2] ?? "").trim(),
      D: String(raw[3] ?? "").trim(),
    };
  }
  if (raw && typeof raw === "object") {
    const lower: AnyRec = {};
    for (const [k, v] of Object.entries(raw as AnyRec)) lower[k.toLowerCase()] = v;
    const A = String(lower.a ?? lower["1"] ?? "").trim();
    const B = String(lower.b ?? lower["2"] ?? "").trim();
    const C = String(lower.c ?? lower["3"] ?? "").trim();
    const D = String(lower.d ?? lower["4"] ?? "").trim();
    return { A, B, C, D };
  }
  return null;
}

// Map "A"/"B"/"C"/"D", "1"-"4", or 0/1/2/3 to a canonical letter.
function normalizeCorrect(raw: unknown, opts: { A: string; B: string; C: string; D: string }): string | null {
  if (typeof raw === "number") {
    const letters = ["A", "B", "C", "D"];
    if (raw >= 0 && raw <= 3) return letters[raw];
    if (raw >= 1 && raw <= 4) return letters[raw - 1];
    return null;
  }
  if (typeof raw !== "string") return null;
  const t = raw.trim().toUpperCase();
  if (["A", "B", "C", "D"].includes(t)) return t;
  if (["1", "2", "3", "4"].includes(t)) return ["A", "B", "C", "D"][parseInt(t, 10) - 1];
  // Allow matching the literal answer text against one of the options.
  const letters: Array<keyof typeof opts> = ["A", "B", "C", "D"];
  for (const L of letters) {
    if (opts[L].trim().toLowerCase() === raw.trim().toLowerCase()) return L as string;
  }
  return null;
}

// Extract a flat array of question objects from many common JSON shapes.
function extractItems(parsed: unknown): { items: AnyRec[] } | { error: string } {
  let value: unknown = parsed;

  // Top-level single quiz: { topic, questions: [...] } -> flatten by spreading topic into each question.
  // Check this BEFORE generic envelope stripping so the topic isn't lost.
  if (value && !Array.isArray(value) && typeof value === "object") {
    const obj = value as AnyRec;
    const topic = pick(obj, "topic");
    const lower: AnyRec = {};
    for (const [k, v] of Object.entries(obj)) lower[k.toLowerCase()] = v;
    const qs = lower.questions;
    if (topic && Array.isArray(qs)) {
      return { items: (qs as AnyRec[]).map((q) => ({ topic, ...q })) };
    }
  }

  // Strip top-level envelope keys: {items:[...]}, {questions:[...]}, {data:[...]}, {quizzes:[...]}, {results:[...]}.
  if (value && !Array.isArray(value) && typeof value === "object") {
    const obj = value as AnyRec;
    const lower: AnyRec = {};
    for (const [k, v] of Object.entries(obj)) lower[k.toLowerCase()] = v;
    for (const key of ["items", "questions", "data", "quizzes", "results"]) {
      if (Array.isArray(lower[key])) {
        value = lower[key];
        break;
      }
    }
  }

  if (!Array.isArray(value)) {
    return {
      error:
        "Expected a JSON array of question objects, or an object with an `items`/`questions` array.",
    };
  }

  // Array of grouped quizzes: [{ topic, questions: [...] }, ...] -> flatten.
  const allHaveQuestionsArr =
    value.length > 0 &&
    value.every((e) => e && typeof e === "object" && Array.isArray((e as AnyRec).questions));
  if (allHaveQuestionsArr) {
    const flat: AnyRec[] = [];
    for (const quiz of value as AnyRec[]) {
      const topic = pick(quiz, "topic");
      for (const q of quiz.questions as AnyRec[]) {
        flat.push({ topic, ...q });
      }
    }
    return { items: flat };
  }

  return { items: value as AnyRec[] };
}

function parseInput(raw: string): ParseResult {
  const warnings: string[] = [];

  // Strip surrounding markdown ```json fences and BOM/whitespace.
  let trimmed = raw.replace(/^\uFEFF/, "").trim();
  const fenced = trimmed.match(/^```(?:json|JSON)?\s*([\s\S]*?)\s*```$/);
  if (fenced) trimmed = fenced[1].trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (e) {
    return { ok: false, warnings, error: e instanceof Error ? e.message : "Invalid JSON" };
  }

  const extracted = extractItems(parsed);
  if ("error" in extracted) {
    return { ok: false, warnings, error: extracted.error };
  }
  const arr = extracted.items;
  if (!arr || arr.length === 0) {
    return { ok: false, warnings, error: "No questions found in the file." };
  }

  const items: BulkImportItem[] = [];
  for (let i = 0; i < arr.length; i++) {
    const row = arr[i];
    const where = `Item #${i + 1}`;
    if (!row || typeof row !== "object") {
      return { ok: false, warnings, error: `${where}: not an object.` };
    }
    const keys = Object.keys(row);
    const fieldsHint = keys.length ? ` Found fields: ${keys.join(", ")}.` : "";

    const topic = String(pick(row, "topic") ?? "").trim();
    const question = String(pick(row, "question") ?? "").trim();
    const optionsRaw = pick(row, "options");
    const options = normalizeOptions(optionsRaw);
    const explanation = String(pick(row, "explanation") ?? "").trim();

    if (!topic) {
      return {
        ok: false,
        warnings,
        error: `${where}: missing "topic".${fieldsHint}`,
      };
    }
    if (!question) {
      return { ok: false, warnings, error: `${where}: missing "question".${fieldsHint}` };
    }
    if (!options) {
      return {
        ok: false,
        warnings,
        error: `${where}: missing "options" — expected an object with A/B/C/D keys, or an array of 4 strings.${fieldsHint}`,
      };
    }
    if (!options.A || !options.B || !options.C || !options.D) {
      return { ok: false, warnings, error: `${where}: each of options.A/B/C/D must be a non-empty string.` };
    }

    const correct = normalizeCorrect(pick(row, "correct_answer"), options);
    if (!correct) {
      return {
        ok: false,
        warnings,
        error: `${where}: "correct_answer" must be A, B, C, or D (or 1-4, or match one of the option strings).`,
      };
    }
    if (!explanation) {
      return { ok: false, warnings, error: `${where}: missing "explanation".${fieldsHint}` };
    }

    const fun = pick(row, "fun_fact");
    const diff = pick(row, "difficulty");
    const img = pick(row, "image_url");
    const cats = normalizeCategories(pick(row, "categories"));

    items.push({
      topic,
      question,
      options,
      correct_answer: correct as "A" | "B" | "C" | "D",
      explanation,
      fun_fact: fun ? String(fun) : null,
      difficulty: diff ? String(diff) : null,
      image_url: img ? String(img) : null,
      categories: cats,
    });
  }
  if (items.length === 0) {
    return { ok: false, warnings, error: "No questions found in the file." };
  }
  return { ok: true, items, warnings };
}

function summarizeByTopic(items: BulkImportItem[]): Array<{ topic: string; count: number }> {
  const map = new Map<string, number>();
  for (const i of items) map.set(i.topic, (map.get(i.topic) ?? 0) + 1);
  return [...map.entries()].map(([topic, count]) => ({ topic, count }));
}

export default function AdminImport() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: categories } = useListCategories();
  const { data: existingQuizzes } = useListQuizzes();
  const bulkImport = useBulkImportQuizzes();

  const [text, setText] = useState("");
  const [categoryId, setCategoryId] = useState<string>("none");
  const [result, setResult] = useState<BulkImportResult | null>(null);

  const parsed = useMemo(() => (text.trim() ? parseInput(text) : null), [text]);
  const summary = parsed?.ok && parsed.items ? summarizeByTopic(parsed.items) : null;
  const existingTitles = useMemo(
    () => new Set((existingQuizzes ?? []).map((q) => q.title)),
    [existingQuizzes],
  );

  const handleFile = async (file: File) => {
    const t = await file.text();
    setText(t);
    setResult(null);
  };

  const handleImport = async () => {
    if (!parsed?.ok || !parsed.items) return;
    try {
      const data = await bulkImport.mutateAsync({
        data: {
          items: parsed.items,
          categoryIds: categoryId !== "none" ? [parseInt(categoryId, 10)] : undefined,
        },
      });
      setResult(data);
      qc.invalidateQueries({ queryKey: getListQuizzesQueryKey() });
      qc.invalidateQueries({ queryKey: getGetCategoryTreeQueryKey() });
      toast({
        title: "Import complete",
        description: `${data.quizzesCreated} new quiz(es), ${data.questionsAdded} question(s) added.`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Import failed";
      toast({ title: "Import failed", description: msg, variant: "destructive" });
    }
  };

  return (
    <div className="container max-w-4xl py-10">
      <Button variant="ghost" asChild className="mb-6 -ml-4 text-muted-foreground">
        <Link href="/admin">
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Admin
        </Link>
      </Button>

      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Bulk Import Quizzes</h1>
        <p className="mt-2 text-muted-foreground">
          Paste or upload a JSON file containing your quiz questions. Each question is
          assigned to a quiz based on its <code className="rounded bg-muted px-1">topic</code> field.
          If a quiz with that title already exists, new questions are appended to it.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileJson className="h-5 w-5 text-primary" /> Source JSON
          </CardTitle>
          <CardDescription>
            Each question needs <code>topic</code>, <code>question</code>,{" "}
            <code>options</code> (A/B/C/D), <code>correct_answer</code>, and{" "}
            <code>explanation</code>. <code>fun_fact</code>, <code>difficulty</code>, and{" "}
            <code>image_url</code> are optional.
            <br />
            Accepted shapes: a flat array of question objects, an envelope like{" "}
            <code>{`{ "questions": [...] }`}</code>, or grouped by quiz like{" "}
            <code>{`[{ "topic": "...", "questions": [...] }]`}</code>. Field names are
            case-insensitive and a few aliases (e.g. <code>answer</code>,{" "}
            <code>prompt</code>) are accepted.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <input
              type="file"
              accept="application/json,.json"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
              className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
              data-testid="input-file"
            />
            <p className="mt-2 text-xs text-muted-foreground">
              Or paste the JSON directly below.
            </p>
          </div>

          <Textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setResult(null);
            }}
            placeholder='[{"topic":"World Capitals","question":"...","options":{"A":"...","B":"...","C":"...","D":"..."},"correct_answer":"A","explanation":"..."}]'
            className="min-h-[240px] font-mono text-xs"
            data-testid="textarea-json"
          />

          {parsed && !parsed.ok && (
            <div className="flex items-start gap-2 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <div>
                <div className="font-semibold">JSON could not be parsed</div>
                <div className="mt-1">{parsed.error}</div>
              </div>
            </div>
          )}

          {parsed?.ok && summary && (
            <div className="rounded-md border bg-muted/30 p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Ready to import — {parsed.items?.length} question(s) across {summary.length} topic(s)
              </h3>
              <ul className="space-y-1 text-sm">
                {summary.map(({ topic, count }) => {
                  const exists = existingTitles.has(topic);
                  return (
                    <li key={topic} className="flex items-center justify-between gap-4">
                      <span className="font-medium">{topic}</span>
                      <span className="text-muted-foreground">
                        {count} question{count === 1 ? "" : "s"} —{" "}
                        {exists ? (
                          <span className="text-amber-600">will append to existing quiz</span>
                        ) : (
                          <span className="text-green-700">will create new quiz</span>
                        )}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium">
                Attach new quizzes to category (optional)
              </label>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger data-testid="select-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="max-h-72">
                  <SelectItem value="none">No category</SelectItem>
                  {(categories ?? []).map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-xs text-muted-foreground">
                Only applied when a new quiz is created. Existing quizzes keep their categories.
              </p>
            </div>
            <div className="flex items-end">
              <Button
                className="w-full"
                onClick={handleImport}
                disabled={!parsed?.ok || bulkImport.isPending}
                data-testid="button-import"
              >
                {bulkImport.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="mr-2 h-4 w-4" />
                )}
                Import {parsed?.ok && parsed.items ? `${parsed.items.length} question(s)` : ""}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {result && (
        <Card className="mt-6 border-green-500/40 bg-green-50/40 dark:bg-green-900/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-green-800 dark:text-green-300">
              <CheckCircle2 className="h-5 w-5" /> Import succeeded
            </CardTitle>
            <CardDescription>
              {result.quizzesCreated} new quiz(es), {result.quizzesUpdated} updated,{" "}
              {result.questionsAdded} question(s) added.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {result.topics.map((t) => (
                <li key={t.topic} className="flex items-center justify-between gap-4">
                  <Link
                    href={`/admin/quizzes/${t.quizId}`}
                    className="font-medium text-primary hover:underline"
                  >
                    {t.topic}
                  </Link>
                  <span className="text-muted-foreground">
                    {t.created ? "created" : "updated"} · +{t.questionsAdded} questions
                  </span>
                </li>
              ))}
            </ul>
            {result.categoriesCreated.length > 0 && (
              <div className="mt-4 border-t pt-3">
                <h4 className="mb-2 text-sm font-semibold">
                  New categories created ({result.categoriesCreated.length})
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {result.categoriesCreated.map((name) => (
                    <span
                      key={name}
                      className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"
                    >
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
