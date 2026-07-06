import { lazy, Suspense, useEffect, useRef } from "react";
import { ClerkProvider, Show, useClerk } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from "wouter";
import { QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { useGetNewsletterSubscription } from "@workspace/api-client-react";
import { Loader2 } from "lucide-react";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { queryClient } from "./lib/queryClient";

// Critical first-paint pages stay statically imported so initial navigation
// doesn't flash a loading state.
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import CategoryPage from "@/pages/category";
import QuizPage from "@/pages/quiz/[id]";
import QuizResultsPage from "@/pages/quiz/[id]/results";
import DailyQuizPage from "@/pages/daily";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { AdminGuard } from "@/components/AdminGuard";

import SignInPage from "@/pages/sign-in";
import SignUpPage from "@/pages/sign-up";

// Secondary public pages load on demand.
const PrivacyPage = lazy(() => import("@/pages/privacy"));
const ContactPage = lazy(() => import("@/pages/contact"));
const AboutPage = lazy(() => import("@/pages/about"));
const CoursesPage = lazy(() => import("@/pages/courses"));
const CourseDetailPage = lazy(() => import("@/pages/courses/[slug]"));
const ModuleTakingPage = lazy(
  () => import("@/pages/courses/[slug]/modules/[moduleSlug]"),
);
const DidYouKnowPage = lazy(() => import("@/pages/did-you-know/index"));
const ArticleDetailPage = lazy(() => import("@/pages/did-you-know/[slug]"));
const ArticlesIndexPage = lazy(() => import("@/pages/articles/index"));
const SeoArticlePage = lazy(() => import("@/pages/articles/[slug]"));
const UserProfilePage = lazy(() => import("@/pages/profile"));

// The admin CMS is lazy-loaded so anonymous visitors never download it.
const AdminDashboard = lazy(() => import("@/pages/admin/index"));
const AdminCategories = lazy(() => import("@/pages/admin/categories"));
const AdminNewsletter = lazy(() => import("@/pages/admin/newsletter"));
const AdminContact = lazy(() => import("@/pages/admin/contact"));
const AdminImageScan = lazy(() => import("@/pages/admin/image-scan"));
const AdminImport = lazy(() => import("@/pages/admin/import"));
const AdminCoursesImport = lazy(() => import("@/pages/admin/courses-import"));
const AdminCourses = lazy(() => import("@/pages/admin/courses"));
const AdminCourseEditor = lazy(() => import("@/pages/admin/course-editor"));
const AdminDidYouKnow = lazy(() => import("@/pages/admin/did-you-know"));
const AdminCreateArticle = lazy(
  () => import("@/pages/admin/did-you-know/articles/new"),
);
const AdminEditArticle = lazy(
  () => import("@/pages/admin/did-you-know/articles/[id]"),
);
const AdminCreateQuiz = lazy(() => import("@/pages/admin/quizzes/new"));
const AdminEditQuiz = lazy(() => import("@/pages/admin/quizzes/[id]"));
const AdminCreateQuestion = lazy(
  () => import("@/pages/admin/quizzes/[id]/questions/new"),
);

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
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

function NewsletterEnrollment() {
  // Captures the signed-in user's email by default (subscribed=true).
  // The GET upserts a subscriber row server-side; opt-out is respected.
  useGetNewsletterSubscription();
  return null;
}

function PageLoader() {
  return (
    <div className="flex py-20 items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-primary" />
    </div>
  );
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
            title: "Welcome back to World Geography Trivia",
            subtitle: "Sign in to continue your adventure",
          },
        },
        signUp: {
          start: {
            title: "Join World Geography Trivia",
            subtitle: "Start exploring the world today",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <Show when="signed-in">
          <NewsletterEnrollment />
        </Show>
        <TooltipProvider>
        <div className="flex flex-col min-h-[100dvh]">
          <Navbar />
          <main className="flex-1">
            <Suspense fallback={<PageLoader />}>
            <Switch>
              <Route path="/" component={Home} />
              <Route path="/category/:slug" component={CategoryPage} />
              <Route path="/sign-in/*?" component={SignInPage} />
              <Route path="/sign-up/*?" component={SignUpPage} />
              <Route path="/profile" component={UserPortal} />
              
              <Route path="/daily" component={DailyQuizPage} />
              <Route path="/privacy" component={PrivacyPage} />
              <Route path="/contact" component={ContactPage} />
              <Route path="/about" component={AboutPage} />
              <Route path="/quiz/:id" component={QuizPage} />
              <Route path="/quiz/:id/results" component={QuizResultsPage} />

              <Route path="/courses" component={CoursesPage} />
              <Route path="/courses/:slug/modules/:moduleSlug" component={ModuleTakingPage} />
              <Route path="/courses/:slug" component={CourseDetailPage} />

              <Route path="/did-you-know" component={DidYouKnowPage} />
              <Route path="/did-you-know/:slug" component={ArticleDetailPage} />

              <Route path="/articles" component={ArticlesIndexPage} />
              <Route path="/articles/:slug" component={SeoArticlePage} />

              <Route path="/admin">
                <AdminGuard><AdminDashboard /></AdminGuard>
              </Route>
              <Route path="/admin/categories">
                <AdminGuard><AdminCategories /></AdminGuard>
              </Route>
              <Route path="/admin/newsletter">
                <AdminGuard><AdminNewsletter /></AdminGuard>
              </Route>
              <Route path="/admin/contact">
                <AdminGuard><AdminContact /></AdminGuard>
              </Route>
              <Route path="/admin/image-scan">
                <AdminGuard><AdminImageScan /></AdminGuard>
              </Route>
              <Route path="/admin/import">
                <AdminGuard><AdminImport /></AdminGuard>
              </Route>
              <Route path="/admin/courses-import">
                <AdminGuard><AdminCoursesImport /></AdminGuard>
              </Route>
              <Route path="/admin/courses">
                <AdminGuard><AdminCourses /></AdminGuard>
              </Route>
              <Route path="/admin/courses/:slug">
                <AdminGuard><AdminCourseEditor /></AdminGuard>
              </Route>
              <Route path="/admin/did-you-know">
                <AdminGuard><AdminDidYouKnow /></AdminGuard>
              </Route>
              <Route path="/admin/did-you-know/articles/new">
                <AdminGuard><AdminCreateArticle /></AdminGuard>
              </Route>
              <Route path="/admin/did-you-know/articles/:id">
                <AdminGuard><AdminEditArticle /></AdminGuard>
              </Route>
              <Route path="/admin/quizzes/new">
                <AdminGuard><AdminCreateQuiz /></AdminGuard>
              </Route>
              <Route path="/admin/quizzes/:id">
                <AdminGuard><AdminEditQuiz /></AdminGuard>
              </Route>
              <Route path="/admin/quizzes/:id/questions/new">
                <AdminGuard><AdminCreateQuestion /></AdminGuard>
              </Route>
              
              <Route component={NotFound} />
            </Switch>
            </Suspense>
          </main>
          <Footer />
        </div>
        <Toaster />
        </TooltipProvider>
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
