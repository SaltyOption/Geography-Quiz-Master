import { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  useBulkImportCourse,
  useListCourses,
  getListCoursesQueryKey,
  type CourseImportItem,
  type CourseImportResult,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  Upload,
  Loader2,
  CheckCircle2,
  AlertCircle,
  FileJson,
  GraduationCap,
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
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { ResponsiveImage } from "@/components/ResponsiveImage";

interface ParseResult {
  ok: boolean;
  items?: CourseImportItem[];
  error?: string;
}

type AnyRec = Record<string, unknown>;

const FIELD_ALIASES: Record<string, string[]> = {
  topic: ["topic", "course", "subject", "title"],
  module: ["module", "module_title", "moduletitle", "section"],
  lesson: ["lesson", "lesson_title", "lessontitle", "unit"],
  question: ["question", "question_text", "prompt", "text", "q"],
  options: ["options", "choices", "answers"],
  correct_answer: ["correct_answer", "correctanswer", "answer", "correct"],
  explanation: ["explanation", "explain", "rationale"],
  fun_fact: ["fun_fact", "funfact", "trivia"],
  learning_objective: ["learning_objective", "learningobjective", "objective", "goal"],
  difficulty: ["difficulty", "level"],
  question_type: ["question_type", "questiontype", "type"],
  mastery_weight: ["mastery_weight", "weight"],
  image_url: ["image_url", "imageurl", "image", "cover", "cover_image"],
};

function pick(obj: AnyRec, key: keyof typeof FIELD_ALIASES): unknown {
  const lower: AnyRec = {};
  for (const [k, v] of Object.entries(obj)) lower[k.toLowerCase()] = v;
  for (const alias of FIELD_ALIASES[key]) if (alias in lower) return lower[alias];
  return undefined;
}

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
    return {
      A: String(lower.a ?? "").trim(),
      B: String(lower.b ?? "").trim(),
      C: String(lower.c ?? "").trim(),
      D: String(lower.d ?? "").trim(),
    };
  }
  return null;
}

function normalizeCorrect(
  raw: unknown,
  opts: { A: string; B: string; C: string; D: string },
): "A" | "B" | "C" | "D" | null {
  if (typeof raw === "number") {
    const letters = ["A", "B", "C", "D"] as const;
    if (raw >= 0 && raw <= 3) return letters[raw];
    if (raw >= 1 && raw <= 4) return letters[raw - 1];
    return null;
  }
  if (typeof raw !== "string") return null;
  const t = raw.trim().toUpperCase();
  if (["A", "B", "C", "D"].includes(t)) return t as "A" | "B" | "C" | "D";
  if (["1", "2", "3", "4"].includes(t)) return (["A", "B", "C", "D"] as const)[parseInt(t, 10) - 1];
  for (const L of ["A", "B", "C", "D"] as const) {
    if (opts[L].trim().toLowerCase() === raw.trim().toLowerCase()) return L;
  }
  return null;
}

function extractItems(parsed: unknown): { items: AnyRec[] } | { error: string } {
  let value: unknown = parsed;

  // Strip top-level envelope keys: { items|questions|data: [...] }.
  if (value && !Array.isArray(value) && typeof value === "object") {
    const lower: AnyRec = {};
    for (const [k, v] of Object.entries(value as AnyRec)) lower[k.toLowerCase()] = v;
    for (const key of ["items", "questions", "data"]) {
      if (Array.isArray(lower[key])) {
        value = lower[key];
        break;
      }
    }
  }

  if (!Array.isArray(value)) {
    return {
      error: "Expected a JSON array of question objects, or an object with an `items` array.",
    };
  }
  return { items: value as AnyRec[] };
}

function parseInput(raw: string): ParseResult {
  let trimmed = raw.replace(/^\uFEFF/, "").trim();
  const fenced = trimmed.match(/^```(?:json|JSON)?\s*([\s\S]*?)\s*```$/);
  if (fenced) trimmed = fenced[1].trim();

  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Invalid JSON" };
  }

  const extracted = extractItems(parsed);
  if ("error" in extracted) return { ok: false, error: extracted.error };
  const arr = extracted.items;
  if (!arr || arr.length === 0) return { ok: false, error: "No questions found in the file." };

  const items: CourseImportItem[] = [];
  for (let i = 0; i < arr.length; i++) {
    const row = arr[i];
    const where = `Item #${i + 1}`;
    if (!row || typeof row !== "object") return { ok: false, error: `${where}: not an object.` };

    const topic = String(pick(row, "topic") ?? "").trim();
    const moduleName = String(pick(row, "module") ?? "").trim();
    const lessonName = String(pick(row, "lesson") ?? "").trim();
    const question = String(pick(row, "question") ?? "").trim();
    const explanation = String(pick(row, "explanation") ?? "").trim();
    const opts = normalizeOptions(pick(row, "options"));

    if (!topic) return { ok: false, error: `${where}: missing "topic".` };
    if (!moduleName) return { ok: false, error: `${where}: missing "module".` };
    if (!lessonName) return { ok: false, error: `${where}: missing "lesson".` };
    if (!question) return { ok: false, error: `${where}: missing "question".` };
    if (!opts || !opts.A || !opts.B || !opts.C || !opts.D)
      return { ok: false, error: `${where}: invalid "options" — need A/B/C/D non-empty strings.` };
    const correct = normalizeCorrect(pick(row, "correct_answer"), opts);
    if (!correct)
      return {
        ok: false,
        error: `${where}: "correct_answer" must be A/B/C/D (or 1-4, or match an option).`,
      };
    if (!explanation) return { ok: false, error: `${where}: missing "explanation".` };

    const fun = pick(row, "fun_fact");
    const objective = pick(row, "learning_objective");
    const diff = pick(row, "difficulty");
    const qtype = pick(row, "question_type");
    const image = pick(row, "image_url");
    const weightRaw = pick(row, "mastery_weight");
    const weight =
      typeof weightRaw === "number"
        ? weightRaw
        : typeof weightRaw === "string" && weightRaw.trim()
        ? Number(weightRaw)
        : null;

    items.push({
      topic,
      module: moduleName,
      lesson: lessonName,
      question,
      options: opts,
      correct_answer: correct,
      explanation,
      fun_fact: fun != null ? String(fun) : null,
      learning_objective: objective != null ? String(objective) : null,
      difficulty: diff != null ? String(diff) : null,
      question_type: qtype != null ? String(qtype) : null,
      mastery_weight: weight !== null && Number.isFinite(weight) ? Math.trunc(weight) : null,
      image_url: image != null && String(image).trim() ? String(image).trim() : null,
    });
  }
  return { ok: true, items };
}

type Summary = {
  topics: Array<{
    topic: string;
    modules: Array<{ name: string; lessons: Array<{ name: string; questionCount: number }> }>;
  }>;
};

function summarize(items: CourseImportItem[]): Summary {
  const topics = new Map<string, Map<string, Map<string, number>>>();
  for (const it of items) {
    if (!topics.has(it.topic)) topics.set(it.topic, new Map());
    const modules = topics.get(it.topic)!;
    if (!modules.has(it.module)) modules.set(it.module, new Map());
    const lessons = modules.get(it.module)!;
    lessons.set(it.lesson, (lessons.get(it.lesson) ?? 0) + 1);
  }
  return {
    topics: [...topics].map(([topic, modules]) => ({
      topic,
      modules: [...modules].map(([name, lessons]) => ({
        name,
        lessons: [...lessons].map(([lname, c]) => ({ name: lname, questionCount: c })),
      })),
    })),
  };
}

export default function AdminCoursesImport() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const bulkImport = useBulkImportCourse();
  const { data: existingCourses } = useListCourses();

  const [text, setText] = useState("");
  const [replaceImage, setReplaceImage] = useState(false);
  const [clearImage, setClearImage] = useState(false);
  const [result, setResult] = useState<CourseImportResult | null>(null);
  const [coverError, setCoverError] = useState(false);
  const [currentCoverError, setCurrentCoverError] = useState(false);

  const parsed = useMemo(() => (text.trim() ? parseInput(text) : null), [text]);
  const summary = parsed?.ok && parsed.items ? summarize(parsed.items) : null;
  const tooManyTopics = summary && summary.topics.length > 1;
  const coverUrl = useMemo(
    () => (parsed?.ok && parsed.items ? parsed.items.find((it) => it.image_url)?.image_url ?? null : null),
    [parsed],
  );

  // Match the parsed payload's topic to an existing course (case-insensitive
  // title match, mirroring how the importer maps topic -> course title) so we
  // can show its current cover and warn before a re-import removes it.
  const topic = useMemo(
    () => (parsed?.ok && parsed.items?.length ? parsed.items[0].topic.trim() : null),
    [parsed],
  );
  const existingCover = useMemo(() => {
    if (!topic || !existingCourses) return null;
    const match = existingCourses.find(
      (c) => c.title.trim().toLowerCase() === topic.toLowerCase(),
    );
    return match?.imageUrl ?? null;
  }, [topic, existingCourses]);
  const willRemoveCover = clearImage && !coverUrl && !!existingCover;
  // "Replace existing cover image" is on, the payload carries a new cover, and
  // the matched course already has a *different* cover — overwriting it is
  // destructive. A same-URL re-import or a fill of a missing cover is not.
  const willReplaceCover =
    replaceImage &&
    !!coverUrl &&
    !!existingCover &&
    coverUrl.trim() !== existingCover.trim();

  const handleFile = async (file: File) => {
    const t = await file.text();
    setText(t);
    setResult(null);
    setCoverError(false);
    setCurrentCoverError(false);
  };

  const handleImport = async () => {
    if (!parsed?.ok || !parsed.items) return;
    try {
      const data = await bulkImport.mutateAsync({
        data: { items: parsed.items, replace_image: replaceImage, clear_image: clearImage },
      });
      setResult(data);
      qc.invalidateQueries({ queryKey: getListCoursesQueryKey() });
      toast({
        title: "Course import complete",
        description: `${data.modulesCreated} new module(s), ${data.lessonsAdded} lesson(s), ${data.questionsAdded} question(s).`,
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
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to admin
        </Link>
      </Button>

      <div className="mb-8">
        <div className="mb-2 inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
          <GraduationCap className="h-3.5 w-3.5" /> Course import
        </div>
        <h1 className="text-3xl font-bold tracking-tight">Bulk import a course</h1>
        <p className="mt-2 text-muted-foreground">
          Paste or upload a JSON array of question objects with{" "}
          <code className="rounded bg-muted px-1">topic</code> ·{" "}
          <code className="rounded bg-muted px-1">module</code> ·{" "}
          <code className="rounded bg-muted px-1">lesson</code> fields. One topic per import.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileJson className="h-5 w-5 text-primary" /> Source JSON
          </CardTitle>
          <CardDescription>
            Required per item: <code>topic</code>, <code>module</code>, <code>lesson</code>,{" "}
            <code>question</code>, <code>options</code> (A/B/C/D), <code>correct_answer</code>,{" "}
            <code>explanation</code>. Optional: <code>fun_fact</code>,{" "}
            <code>learning_objective</code>, <code>difficulty</code>, <code>question_type</code>,{" "}
            <code>mastery_weight</code>, <code>image_url</code> (course cover — taken from the
            first item that has one; locally hosted <code>/regions/</code> &amp;{" "}
            <code>/landmarks/</code> URLs must have their responsive variants, external URLs must
            be reachable).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <input
            type="file"
            accept="application/json,.json"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) handleFile(f);
            }}
            className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
            data-testid="input-course-file"
          />

          <Textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setResult(null);
              setCoverError(false);
              setCurrentCoverError(false);
            }}
            placeholder='[{"topic":"World Deserts","module":"Module 1","lesson":"Intro","question":"...","options":{"A":"...","B":"...","C":"...","D":"..."},"correct_answer":"A","explanation":"..."}]'
            className="min-h-[240px] font-mono text-xs"
            data-testid="textarea-course-json"
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

          {summary && (
            <div className="rounded-md border bg-muted/30 p-4">
              <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <CheckCircle2 className="h-4 w-4 text-green-600" />
                Ready to import — {parsed?.items?.length} question(s)
              </h3>
              {tooManyTopics && (
                <div className="mb-3 flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-50/50 p-2 text-xs text-amber-800 dark:bg-amber-900/20 dark:text-amber-200">
                  <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>
                    Multiple topics detected. Course import expects exactly one topic per request.
                  </span>
                </div>
              )}
              {coverUrl && (
                <div className="mb-3" data-testid="course-cover-preview">
                  <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Course cover
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-md border bg-muted">
                      {coverError ? (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                          <AlertCircle className="h-5 w-5" />
                        </div>
                      ) : (
                        <ResponsiveImage
                          src={coverUrl}
                          alt="Course cover preview"
                          className="h-full w-full object-cover"
                          onError={() => setCoverError(true)}
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 text-xs">
                      <div className="break-all font-mono text-muted-foreground">{coverUrl}</div>
                      {coverError && (
                        <div className="mt-1.5 flex items-start gap-1.5 text-amber-700 dark:text-amber-300">
                          <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                          <span>
                            This cover image couldn&apos;t be previewed — it may be broken,
                            unreachable, or missing its responsive variants. Fix it before importing
                            or the import will be rejected.
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
              {existingCover && (
                <div className="mb-3" data-testid="current-cover-preview">
                  <div className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Current cover{" "}
                    <span className="font-normal normal-case tracking-normal">
                      (on the existing course)
                    </span>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-md border bg-muted">
                      {currentCoverError ? (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                          <AlertCircle className="h-5 w-5" />
                        </div>
                      ) : (
                        <ResponsiveImage
                          src={existingCover}
                          alt="Current course cover"
                          className="h-full w-full object-cover"
                          onError={() => setCurrentCoverError(true)}
                        />
                      )}
                    </div>
                    <div className="min-w-0 flex-1 text-xs">
                      <div className="break-all font-mono text-muted-foreground">
                        {existingCover}
                      </div>
                    </div>
                  </div>
                </div>
              )}
              {summary.topics.map((t) => (
                <div key={t.topic} className="space-y-2 text-sm">
                  <div className="font-semibold">{t.topic}</div>
                  <ul className="ml-4 list-disc space-y-1 text-muted-foreground">
                    {t.modules.map((m) => (
                      <li key={m.name}>
                        <span className="font-medium text-foreground">{m.name}</span> —{" "}
                        {m.lessons.length} lesson{m.lessons.length === 1 ? "" : "s"} (
                        {m.lessons.reduce((sum, l) => sum + l.questionCount, 0)} questions)
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}

          <div className="flex items-start gap-3 rounded-md border bg-muted/30 p-3">
            <Switch
              id="replace-image"
              checked={replaceImage}
              onCheckedChange={setReplaceImage}
              data-testid="switch-replace-image"
            />
            <div className="space-y-0.5">
              <Label htmlFor="replace-image" className="cursor-pointer text-sm font-medium">
                Replace existing cover image
              </Label>
              <p className="text-xs text-muted-foreground">
                When re-importing an existing course, overwrite its current cover with the{" "}
                <code>image_url</code> from this payload. Off by default, so re-import only fills
                in a missing cover and never replaces one you set manually.
              </p>
              {willReplaceCover && (
                <div
                  className="mt-2 rounded-md border border-destructive/50 bg-destructive/10 p-2 text-xs text-destructive"
                  data-testid="cover-replace-warning"
                >
                  <div className="flex items-start gap-1.5">
                    <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                    <span>
                      This import will overwrite the current cover on{" "}
                      <span className="font-semibold">{topic}</span> with the new image below.
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="text-center">
                      <div className="relative h-14 w-20 overflow-hidden rounded-md border bg-muted">
                        {currentCoverError ? (
                          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                            <AlertCircle className="h-4 w-4" />
                          </div>
                        ) : (
                          <ResponsiveImage
                            src={existingCover!}
                            alt="Current course cover"
                            className="h-full w-full object-cover"
                            onError={() => setCurrentCoverError(true)}
                          />
                        )}
                      </div>
                      <div className="mt-1 font-medium uppercase tracking-wider text-muted-foreground">
                        Current
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <div className="text-center">
                      <div className="relative h-14 w-20 overflow-hidden rounded-md border bg-muted">
                        {coverError ? (
                          <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                            <AlertCircle className="h-4 w-4" />
                          </div>
                        ) : (
                          <ResponsiveImage
                            src={coverUrl!}
                            alt="New course cover"
                            className="h-full w-full object-cover"
                            onError={() => setCoverError(true)}
                          />
                        )}
                      </div>
                      <div className="mt-1 font-medium uppercase tracking-wider text-muted-foreground">
                        New
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-md border bg-muted/30 p-3">
            <Switch
              id="clear-image"
              checked={clearImage}
              onCheckedChange={setClearImage}
              disabled={!!coverUrl}
              data-testid="switch-clear-image"
            />
            <div className="space-y-0.5">
              <Label htmlFor="clear-image" className="cursor-pointer text-sm font-medium">
                Remove existing cover image
              </Label>
              <p className="text-xs text-muted-foreground">
                When re-importing an existing course with no <code>image_url</code> in this
                payload, remove its current cover so re-import becomes the single source of truth.
                Off by default and ignored when the payload includes a cover image.
              </p>
              {willRemoveCover && (
                <div
                  className="mt-2 flex items-start gap-1.5 rounded-md border border-destructive/50 bg-destructive/10 p-2 text-xs text-destructive"
                  data-testid="cover-removal-warning"
                >
                  <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>
                    This import will remove the current cover from{" "}
                    <span className="font-semibold">{topic}</span>. The course will have no cover
                    image afterwards.
                  </span>
                </div>
              )}
            </div>
          </div>

          <Button
            className="w-full"
            onClick={handleImport}
            disabled={!parsed?.ok || tooManyTopics === true || bulkImport.isPending}
            data-testid="button-course-import"
          >
            {bulkImport.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Upload className="mr-2 h-4 w-4" />
            )}
            Import course
          </Button>
        </CardContent>
      </Card>

      {result && (
        <Card className="mt-6 border-green-500/40 bg-green-50/40 dark:bg-green-900/10">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg text-green-800 dark:text-green-300">
              <CheckCircle2 className="h-5 w-5" /> Import succeeded
            </CardTitle>
            <CardDescription>
              <Link
                href={`/courses/${result.courseSlug}`}
                className="font-semibold text-primary hover:underline"
              >
                {result.courseTitle}
              </Link>{" "}
              · {result.courseCreated ? "course created" : "course updated"} ·{" "}
              {result.modulesCreated} new module(s) · {result.lessonsAdded} lesson(s) ·{" "}
              {result.questionsAdded} question(s) added.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-1 text-sm">
              {result.modules.map((m) => (
                <li key={m.slug} className="flex items-center justify-between gap-4">
                  <span className="font-medium">{m.title}</span>
                  <span className="text-muted-foreground">
                    {m.created ? "created" : "updated"} · +{m.lessonsAdded} lessons, +
                    {m.questionsAdded} questions
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
