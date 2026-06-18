import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";

const useListCoursesMock = vi.fn();
const useBulkImportCourseMock = vi.fn();
const toastMock = vi.fn();

vi.mock("@workspace/api-client-react", () => ({
  useListCourses: (...args: unknown[]) => useListCoursesMock(...args),
  useBulkImportCourse: (...args: unknown[]) => useBulkImportCourseMock(...args),
  getListCoursesQueryKey: () => ["courses"],
}));

vi.mock("@tanstack/react-query", () => ({
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
}));

vi.mock("wouter", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/hooks/use-toast", () => ({
  useToast: () => ({ toast: toastMock }),
}));

vi.mock("@/components/ResponsiveImage", () => ({
  ResponsiveImage: ({ src, alt }: { src: string; alt: string }) => (
    <img src={src} alt={alt} />
  ),
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children, ...props }: ComponentProps<"div">) => <div {...props}>{children}</div>,
  CardHeader: ({ children, ...props }: ComponentProps<"div">) => <div {...props}>{children}</div>,
  CardContent: ({ children, ...props }: ComponentProps<"div">) => <div {...props}>{children}</div>,
  CardTitle: ({ children, ...props }: ComponentProps<"div">) => <div {...props}>{children}</div>,
  CardDescription: ({ children, ...props }: ComponentProps<"div">) => (
    <div {...props}>{children}</div>
  ),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    asChild: _asChild,
    ...rest
  }: ComponentProps<"button"> & { asChild?: boolean }) => <button {...rest}>{children}</button>,
}));

vi.mock("@/components/ui/textarea", () => ({
  Textarea: (props: ComponentProps<"textarea">) => <textarea {...props} />,
}));

vi.mock("@/components/ui/label", () => ({
  Label: ({ children, ...props }: ComponentProps<"label">) => <label {...props}>{children}</label>,
}));

vi.mock("@/components/ui/switch", () => ({
  Switch: ({
    checked,
    onCheckedChange,
    disabled,
    ...props
  }: {
    checked?: boolean;
    onCheckedChange?: (next: boolean) => void;
    disabled?: boolean;
  } & ComponentProps<"button">) => (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onCheckedChange?.(!checked)}
      {...props}
    />
  ),
}));

import AdminCoursesImport from "./courses-import";

type ItemOverrides = { topic?: string; imageUrl?: string | null };

function payload({ topic = "World Deserts", imageUrl }: ItemOverrides = {}): string {
  const item: Record<string, unknown> = {
    topic,
    module: "Module 1",
    lesson: "Lesson 1",
    question: "Which desert is the largest?",
    options: { A: "Sahara", B: "Gobi", C: "Mojave", D: "Atacama" },
    correct_answer: "A",
    explanation: "The Sahara is the largest hot desert.",
  };
  if (imageUrl) item.image_url = imageUrl;
  return JSON.stringify([item]);
}

function setExistingCourses(courses: Array<{ title: string; imageUrl: string | null }>) {
  useListCoursesMock.mockReturnValue({ data: courses });
}

function typePayload(json: string) {
  const textarea = screen.getByTestId("textarea-course-json");
  fireEvent.change(textarea, { target: { value: json } });
}

beforeEach(() => {
  useListCoursesMock.mockReset();
  useBulkImportCourseMock.mockReset();
  toastMock.mockReset();
  useBulkImportCourseMock.mockReturnValue({ mutateAsync: vi.fn(), isPending: false });
  setExistingCourses([]);
});

describe("AdminCoursesImport — cover replace warning", () => {
  it("shows the replace warning when the switch is on, the payload has a new cover, and the existing course has a different cover", () => {
    setExistingCourses([{ title: "World Deserts", imageUrl: "/regions/old-cover.jpg" }]);
    render(<AdminCoursesImport />);

    typePayload(payload({ imageUrl: "/regions/new-cover.jpg" }));
    expect(screen.queryByTestId("cover-replace-warning")).toBeNull();

    fireEvent.click(screen.getByTestId("switch-replace-image"));
    expect(screen.getByTestId("cover-replace-warning")).toBeInTheDocument();
  });

  it("does not show the replace warning for a same-URL re-import", () => {
    setExistingCourses([{ title: "World Deserts", imageUrl: "/regions/same-cover.jpg" }]);
    render(<AdminCoursesImport />);

    typePayload(payload({ imageUrl: "/regions/same-cover.jpg" }));
    fireEvent.click(screen.getByTestId("switch-replace-image"));

    expect(screen.queryByTestId("cover-replace-warning")).toBeNull();
  });

  it("does not show the replace warning when the existing course has no cover", () => {
    setExistingCourses([{ title: "World Deserts", imageUrl: null }]);
    render(<AdminCoursesImport />);

    typePayload(payload({ imageUrl: "/regions/new-cover.jpg" }));
    fireEvent.click(screen.getByTestId("switch-replace-image"));

    expect(screen.queryByTestId("cover-replace-warning")).toBeNull();
  });

  it("does not show the replace warning when no existing course matches the topic", () => {
    setExistingCourses([{ title: "World Oceans", imageUrl: "/regions/oceans.jpg" }]);
    render(<AdminCoursesImport />);

    typePayload(payload({ imageUrl: "/regions/new-cover.jpg" }));
    fireEvent.click(screen.getByTestId("switch-replace-image"));

    expect(screen.queryByTestId("cover-replace-warning")).toBeNull();
  });

  it("does not show the replace warning while the replace switch is off", () => {
    setExistingCourses([{ title: "World Deserts", imageUrl: "/regions/old-cover.jpg" }]);
    render(<AdminCoursesImport />);

    typePayload(payload({ imageUrl: "/regions/new-cover.jpg" }));

    expect(screen.queryByTestId("cover-replace-warning")).toBeNull();
  });
});

describe("AdminCoursesImport — cover removal warning", () => {
  it("shows the removal warning when the switch is on, the payload has no cover, and the existing course has one", () => {
    setExistingCourses([{ title: "World Deserts", imageUrl: "/regions/old-cover.jpg" }]);
    render(<AdminCoursesImport />);

    typePayload(payload({ imageUrl: null }));
    expect(screen.queryByTestId("cover-removal-warning")).toBeNull();

    fireEvent.click(screen.getByTestId("switch-clear-image"));
    expect(screen.getByTestId("cover-removal-warning")).toBeInTheDocument();
  });

  it("does not show the removal warning when no existing course matches the topic", () => {
    setExistingCourses([{ title: "World Oceans", imageUrl: "/regions/oceans.jpg" }]);
    render(<AdminCoursesImport />);

    typePayload(payload({ imageUrl: null }));
    fireEvent.click(screen.getByTestId("switch-clear-image"));

    expect(screen.queryByTestId("cover-removal-warning")).toBeNull();
  });

  it("does not show the removal warning while the clear switch is off", () => {
    setExistingCourses([{ title: "World Deserts", imageUrl: "/regions/old-cover.jpg" }]);
    render(<AdminCoursesImport />);

    typePayload(payload({ imageUrl: null }));

    expect(screen.queryByTestId("cover-removal-warning")).toBeNull();
  });

  it("keeps the clear switch disabled (and no removal warning) when the payload carries a cover", () => {
    setExistingCourses([{ title: "World Deserts", imageUrl: "/regions/old-cover.jpg" }]);
    render(<AdminCoursesImport />);

    typePayload(payload({ imageUrl: "/regions/new-cover.jpg" }));

    const clearSwitch = screen.getByTestId("switch-clear-image");
    expect(clearSwitch).toBeDisabled();

    fireEvent.click(clearSwitch);
    expect(screen.queryByTestId("cover-removal-warning")).toBeNull();
  });
});
