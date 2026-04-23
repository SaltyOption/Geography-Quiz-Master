import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ComponentProps, ReactNode } from "react";

const useGetMeMock = vi.fn();

vi.mock("@workspace/api-client-react", () => ({
  useGetMe: (...args: unknown[]) => useGetMeMock(...args),
}));

vi.mock("wouter", () => ({
  Link: ({ children, href }: { children: ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

vi.mock("@/components/ui/card", () => ({
  Card: ({ children, ...props }: ComponentProps<"div">) => (
    <div {...props}>{children}</div>
  ),
  CardHeader: ({ children, ...props }: ComponentProps<"div">) => (
    <div {...props}>{children}</div>
  ),
  CardContent: ({ children, ...props }: ComponentProps<"div">) => (
    <div {...props}>{children}</div>
  ),
  CardTitle: ({ children, ...props }: ComponentProps<"div">) => (
    <div {...props}>{children}</div>
  ),
  CardDescription: ({ children, ...props }: ComponentProps<"div">) => (
    <div {...props}>{children}</div>
  ),
}));

vi.mock("@/components/ui/button", () => ({
  Button: ({
    children,
    asChild: _asChild,
    ...rest
  }: ComponentProps<"button"> & { asChild?: boolean }) => (
    <button {...rest}>{children}</button>
  ),
}));

import { AdminGuard } from "./AdminGuard";

beforeEach(() => {
  useGetMeMock.mockReset();
});

describe("<AdminGuard />", () => {
  it("renders a loading spinner while the request is in flight", () => {
    useGetMeMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    });

    const { container } = render(
      <AdminGuard>
        <div>secret-admin-content</div>
      </AdminGuard>,
    );

    expect(container.querySelector(".animate-spin")).not.toBeNull();
    expect(screen.queryByText("secret-admin-content")).toBeNull();
  });

  it("renders an error card when the request fails", () => {
    useGetMeMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    });

    render(
      <AdminGuard>
        <div>secret-admin-content</div>
      </AdminGuard>,
    );

    expect(screen.getByText("Couldn't verify access")).toBeInTheDocument();
    expect(screen.queryByText("secret-admin-content")).toBeNull();
  });

  it("renders an error card when no data is returned", () => {
    useGetMeMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
    });

    render(
      <AdminGuard>
        <div>secret-admin-content</div>
      </AdminGuard>,
    );

    expect(screen.getByText("Couldn't verify access")).toBeInTheDocument();
    expect(screen.queryByText("secret-admin-content")).toBeNull();
  });

  it("prompts to sign in when there is no userId", () => {
    useGetMeMock.mockReturnValue({
      data: { userId: null, isAdmin: false },
      isLoading: false,
      isError: false,
    });

    render(
      <AdminGuard>
        <div>secret-admin-content</div>
      </AdminGuard>,
    );

    expect(screen.getByText("Sign in required")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sign in/i })).toHaveAttribute(
      "href",
      "/sign-in",
    );
    expect(screen.queryByText("secret-admin-content")).toBeNull();
  });

  it("shows the Clerk user ID for a signed-in non-admin", () => {
    const userId = "user_clerk_abc123";
    useGetMeMock.mockReturnValue({
      data: { userId, isAdmin: false },
      isLoading: false,
      isError: false,
    });

    render(
      <AdminGuard>
        <div>secret-admin-content</div>
      </AdminGuard>,
    );

    expect(screen.getByText("Not yet an admin")).toBeInTheDocument();
    expect(screen.getByText(userId)).toBeInTheDocument();
    expect(screen.getByText("ADMIN_USER_IDS")).toBeInTheDocument();
    expect(screen.queryByText("secret-admin-content")).toBeNull();
  });

  it("renders children when the user is an allow-listed admin", () => {
    useGetMeMock.mockReturnValue({
      data: { userId: "user_admin_123", isAdmin: true },
      isLoading: false,
      isError: false,
    });

    render(
      <AdminGuard>
        <div>secret-admin-content</div>
      </AdminGuard>,
    );

    expect(screen.getByText("secret-admin-content")).toBeInTheDocument();
    expect(screen.queryByText("Sign in required")).toBeNull();
    expect(screen.queryByText("Not yet an admin")).toBeNull();
  });
});
