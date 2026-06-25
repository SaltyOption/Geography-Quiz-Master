import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";

// --- Mocks -----------------------------------------------------------------
// The resume logic under test lives entirely in this page component: it reads
// the saved progress embedded in the module GET, restores the learner onto the
// right question, shows the "Welcome back" banner, and (when every question was
// already answered) re-fetches the inline explanation/fun fact via the check
// endpoint. We mock the data hooks so we can feed in different saved-progress
// shapes and assert the rendered restore state for each.

const getCourseModuleMock = vi.fn();
const checkAnswerMutateMock = vi.fn();

// Fixture: a 3-question module across two lessons. Question fields mirror the
// real CourseQuestion shape the component consumes.
const QUESTIONS = [
  {
    id: 100,
    text: "Which ocean is the largest?",
    options: ["Atlantic", "Indian", "Pacific", "Arctic"],
    correctOption: 2,
    explanation: "The Pacific is the largest and deepest ocean.",
    funFact: "It holds more than half of Earth's free water.",
    learningObjective: "Identify the largest ocean",
    lessonTitle: "Lesson 1",
  },
  {
    id: 101,
    text: "Which sea is the saltiest?",
    options: ["Dead Sea", "Red Sea", "Baltic Sea", "Black Sea"],
    correctOption: 0,
    explanation: "The Dead Sea has extreme salinity.",
    funFact: "Its salinity lets swimmers float effortlessly.",
    learningObjective: "Identify the saltiest sea",
    lessonTitle: "Lesson 1",
  },
  {
    id: 102,
    text: "What is the deepest ocean trench?",
    options: ["Java Trench", "Mariana Trench", "Tonga Trench", "Puerto Rico Trench"],
    correctOption: 1,
    explanation: "The Mariana Trench is the deepest known point.",
    funFact: "It reaches nearly 11 km below sea level.",
    learningObjective: "Identify the deepest trench",
    lessonTitle: "Lesson 2",
  },
];

function questionById(id: number) {
  return QUESTIONS.find((q) => q.id === id)!;
}

// Build the module GET payload with a chosen set of saved answers.
function moduleData(savedAnswers: Array<{ questionId: number; selectedOption: number }> | null) {
  return {
    id: 5,
    courseSlug: "oceans-and-seas",
    courseTitle: "Oceans and Seas",
    title: "Ocean Foundations",
    nextModule: null,
    lessons: [
      {
        title: "Lesson 1",
        questions: [
          { ...QUESTIONS[0] },
          { ...QUESTIONS[1] },
        ],
      },
      {
        title: "Lesson 2",
        questions: [{ ...QUESTIONS[2] }],
      },
    ],
    progress: savedAnswers ? { answers: savedAnswers } : null,
  };
}

vi.mock("@workspace/api-client-react", () => ({
  useGetCourseModule: () => getCourseModuleMock(),
  getGetCourseModuleQueryKey: () => ["course-module"],
  useSubmitCourseModuleAttempt: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useSaveCourseModuleProgress: () => ({ mutate: vi.fn(), isPending: false }),
  useClearCourseModuleProgress: () => ({ mutate: vi.fn(), isPending: false }),
  // Faithful to the real check endpoint: the inline feedback content is derived
  // from the question's own answer key + explanation/fun fact, keyed by the
  // questionId the component asks about — not arbitrary fixture text.
  useCheckCourseModuleAnswer: () => ({
    mutate: (
      vars: { questionId: number; data: { selectedOption: number } },
      opts?: { onSuccess?: (res: unknown) => void },
    ) => {
      checkAnswerMutateMock(vars);
      const q = questionById(vars.questionId);
      opts?.onSuccess?.({
        questionId: q.id,
        selectedOption: vars.data.selectedOption,
        correctOption: q.correctOption,
        isCorrect: vars.data.selectedOption === q.correctOption,
        explanation: q.explanation,
        funFact: q.funFact,
      });
    },
    isPending: false,
  }),
}));

vi.mock("@clerk/react", () => ({
  useAuth: () => ({ isSignedIn: true, isLoaded: true }),
  Show: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

vi.mock("wouter", () => ({
  useParams: () => ({ slug: "oceans-and-seas", moduleSlug: "ocean-foundations" }),
  useLocation: () => ["/", vi.fn()],
  Link: ({ children, href }: { children: ReactNode; href: string }) => <a href={href}>{children}</a>,
}));

// renderMarkdown is exercised in its own package's tests; here we only need the
// explanation/fun-fact text to land in the DOM so we can assert on it.
vi.mock("@workspace/markdown", () => ({
  renderMarkdown: (input: string) => input,
}));

vi.mock("@/components/Mascot", () => ({
  Mascot: () => null,
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    asChild: _asChild,
    ...rest
  }: ComponentProps<"button"> & { asChild?: boolean }) => <button {...rest}>{children}</button>,
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children, ...props }: ComponentProps<"div">) => <div {...props}>{children}</div>,
  CardHeader: ({ children, ...props }: ComponentProps<"div">) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: ComponentProps<"div">) => <div {...props}>{children}</div>,
  CardTitle: ({ children, ...props }: ComponentProps<"div">) => <div {...props}>{children}</div>,
  CardDescription: ({ children, ...props }: ComponentProps<"div">) => <div {...props}>{children}</div>,
}));

vi.mock("@/components/ui/progress", () => ({
  Progress: (props: ComponentProps<"div">) => <div {...props} />,
}));

vi.mock("@/components/ui/badge", () => ({
  Badge: ({ children, ...props }: ComponentProps<"span">) => <span {...props}>{children}</span>,
}));

import ModuleTakingPage from "./[moduleSlug]";

beforeEach(() => {
  getCourseModuleMock.mockReset();
  checkAnswerMutateMock.mockReset();
  getCourseModuleMock.mockReturnValue({
    data: moduleData(null),
    isLoading: false,
    error: null,
    refetch: vi.fn(),
  });
});

describe("ModuleTakingPage — resume experience", () => {
  it("starts fresh with no resume banner when there is no saved progress", () => {
    render(<ModuleTakingPage />);

    expect(screen.queryByTestId("banner-resumed")).toBeNull();
    // Progress indicator shows the first question.
    expect(screen.getByText("1 / 3")).toBeInTheDocument();
    expect(screen.getByText(QUESTIONS[0].text)).toBeInTheDocument();
    // No inline feedback until the learner answers.
    expect(screen.queryByTestId("module-feedback")).toBeNull();
  });

  it("resumes a partially-completed module on the next un-answered question", () => {
    // One of three questions answered -> land on question 2 (index 1).
    getCourseModuleMock.mockReturnValue({
      data: moduleData([{ questionId: 100, selectedOption: 2 }]),
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<ModuleTakingPage />);

    // "Welcome back" banner reflects how many were already answered.
    const banner = screen.getByTestId("banner-resumed");
    expect(banner).toHaveTextContent("Welcome back");
    expect(banner).toHaveTextContent("1 of 3");

    // Restored onto the SECOND question (the next un-answered one).
    expect(screen.getByText("2 / 3")).toBeInTheDocument();
    expect(screen.getByText(QUESTIONS[1].text)).toBeInTheDocument();

    // The next un-answered question is not yet answered, so no inline feedback.
    expect(screen.queryByTestId("module-feedback")).toBeNull();
  });

  it("restores onto an already-answered last question with inline explanation and fun fact", async () => {
    // Every question answered but never submitted -> restore the LAST question
    // with its feedback re-fetched via the check endpoint.
    getCourseModuleMock.mockReturnValue({
      data: moduleData([
        { questionId: 100, selectedOption: 2 },
        { questionId: 101, selectedOption: 0 },
        { questionId: 102, selectedOption: 1 },
      ]),
      isLoading: false,
      error: null,
      refetch: vi.fn(),
    });

    render(<ModuleTakingPage />);

    const banner = screen.getByTestId("banner-resumed");
    expect(banner).toHaveTextContent("3 of 3");

    // Restored onto the last question.
    expect(screen.getByText("3 / 3")).toBeInTheDocument();
    expect(screen.getByText(QUESTIONS[2].text)).toBeInTheDocument();

    // The component asks the check endpoint to repopulate feedback for the
    // restored (already-answered) question.
    await waitFor(() => {
      expect(checkAnswerMutateMock).toHaveBeenCalledWith(
        expect.objectContaining({ questionId: 102, data: { selectedOption: 1 } }),
      );
    });

    // Inline explanation + fun fact for the restored question are shown.
    const feedback = await screen.findByTestId("module-feedback");
    expect(feedback).toBeInTheDocument();
    expect(feedback).toHaveTextContent("Correct!");
    expect(feedback).toHaveTextContent(QUESTIONS[2].explanation);
    expect(feedback).toHaveTextContent(QUESTIONS[2].funFact);
  });
});
