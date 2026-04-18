import { useEffect, useRef } from "react";
import { ClerkProvider, Show, useClerk } from "@clerk/react";
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from "wouter";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { queryClient } from "./lib/queryClient";

import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import QuizPage from "@/pages/quiz/[id]";
import QuizResultsPage from "@/pages/quiz/[id]/results";
import AdminDashboard from "@/pages/admin/index";
import AdminCreateQuiz from "@/pages/admin/quizzes/new";
import AdminEditQuiz from "@/pages/admin/quizzes/[id]";
import AdminCreateQuestion from "@/pages/admin/quizzes/[id]/questions/new";
import { Navbar } from "@/components/layout/Navbar";

import SignInPage from "@/pages/sign-in";
import SignUpPage from "@/pages/sign-up";
import UserProfilePage from "@/pages/profile";

const clerkPubKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');
}

const clerkAppearance = {
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "hsl(200, 80%, 40%)", // Ocean Blue
    colorBackground: "hsl(40, 33%, 98%)", // Warm off-white
    colorInputBackground: "hsl(40, 20%, 94%)", // Muted
    colorText: "hsl(20, 15%, 15%)", // Deep brown-grey
    colorTextSecondary: "hsl(25, 10%, 45%)", // Muted foreground
    colorInputText: "hsl(20, 15%, 15%)",
    colorNeutral: "hsl(20, 15%, 15%)",
    borderRadius: "0.75rem",
    fontFamily: "'Outfit', sans-serif",
    fontFamilyButtons: "'Outfit', sans-serif",
  },
  elements: {
    rootBox: "w-full",
    cardBox: "rounded-2xl w-full overflow-hidden border border-border shadow-md",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none border-t border-border bg-muted/20",
    headerTitle: { color: "hsl(20, 15%, 15%)" },
    headerSubtitle: { color: "hsl(25, 10%, 45%)" },
    socialButtonsBlockButtonText: { color: "hsl(20, 15%, 15%)" },
    formFieldLabel: { color: "hsl(20, 15%, 15%)" },
    footerActionLink: { color: "hsl(200, 80%, 40%)" },
    footerActionText: { color: "hsl(25, 10%, 45%)" },
    dividerText: { color: "hsl(25, 10%, 45%)" },
    identityPreviewEditButton: { color: "hsl(200, 80%, 40%)" },
    formFieldSuccessText: { color: "hsl(150, 40%, 45%)" },
    alertText: { color: "hsl(0, 70%, 50%)" },
    logoImage: "h-12 w-12",
  },
};

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        queryClient.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);

  return null;
}

function UserPortal() {
  return (
    <>
      <Show when="signed-in">
        <UserProfilePage />
      </Show>
      <Show when="signed-out">
        <Redirect to="/" />
      </Show>
    </>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      localization={{
        signIn: {
          start: {
            title: "Welcome back to AtlasQuest",
            subtitle: "Sign in to continue your adventure",
          },
        },
        signUp: {
          start: {
            title: "Join AtlasQuest",
            subtitle: "Start exploring the world today",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <div className="flex flex-col min-h-[100dvh]">
          <Navbar />
          <main className="flex-1">
            <Switch>
              <Route path="/" component={Home} />
              <Route path="/sign-in/*?" component={SignInPage} />
              <Route path="/sign-up/*?" component={SignUpPage} />
              <Route path="/profile" component={UserPortal} />
              
              <Route path="/quiz/:id" component={QuizPage} />
              <Route path="/quiz/:id/results" component={QuizResultsPage} />
              
              <Route path="/admin" component={AdminDashboard} />
              <Route path="/admin/quizzes/new" component={AdminCreateQuiz} />
              <Route path="/admin/quizzes/:id" component={AdminEditQuiz} />
              <Route path="/admin/quizzes/:id/questions/new" component={AdminCreateQuestion} />
              
              <Route component={NotFound} />
            </Switch>
          </main>
        </div>
        <Toaster />
        <TooltipProvider />
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;
