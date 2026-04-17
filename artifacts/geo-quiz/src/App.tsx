import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import Home from "@/pages/home";
import QuizPage from "@/pages/quiz/[id]";
import QuizResultsPage from "@/pages/quiz/[id]/results";
import AdminDashboard from "@/pages/admin/index";
import AdminCreateQuiz from "@/pages/admin/quizzes/new";
import AdminEditQuiz from "@/pages/admin/quizzes/[id]";
import AdminCreateQuestion from "@/pages/admin/quizzes/[id]/questions/new";
import { Navbar } from "@/components/layout/Navbar";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
    },
  },
});

function Router() {
  return (
    <div className="flex flex-col min-h-[100dvh]">
      <Navbar />
      <main className="flex-1">
        <Switch>
          <Route path="/" component={Home} />
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
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
