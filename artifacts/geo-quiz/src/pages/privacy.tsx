import { Link } from "wouter";
import { usePageMeta, canonicalOrigin } from "@/hooks/usePageMeta";
import { Shield, Mail, Database, Cookie, Lock, Megaphone } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

const sections: Array<{
  icon: typeof Shield;
  title: string;
  body: string;
}> = [
  {
    icon: Shield,
    title: "We will never sell your information",
    body: "Your account details and quiz history are yours. We do not sell, rent, or trade your personal information. We do show ads from third-party advertising partners, who may set cookies to display relevant ads — but we never hand them your account details or quiz history.",
  },
  {
    icon: Database,
    title: "What we collect",
    body: "When you create an account we store your sign-in identity (such as your email or social login) through our authentication provider, plus the quizzes you take and the scores you earn so we can show you your progress.",
  },
  {
    icon: Lock,
    title: "How we use it",
    body: "We use your information to operate the site: signing you in, saving your scores, and showing you your quiz history. If you have an account, we may also use your email to send you our newsletter with occasional updates and new quizzes — you can opt out anytime from your profile page.",
  },
  {
    icon: Megaphone,
    title: "Advertising",
    body: "To help keep World Geography Trivia free, we display ads from third-party advertising partners. These partners may use cookies to show ads and measure how they perform. We never give them your account details or quiz history.",
  },
  {
    icon: Cookie,
    title: "Cookies & sessions",
    body: "We use a small number of cookies to keep you signed in and remember preferences such as whether you've dismissed our sign-up banner. Our advertising partners may also set cookies to display and measure ads; where the law requires it, we'll ask for your consent first.",
  },
  {
    icon: Mail,
    title: "Questions or requests",
    body: "If you'd like to delete your account or have any questions about your data, get in touch through the contact details on the sign-in page.",
  },
];

export default function PrivacyPage() {
  usePageMeta({
    title: "Privacy Policy",
    description:
      "Read the World Geography Trivia privacy policy. We never sell your data, collect only what we need to run the site, and let you delete your account at any time.",
    canonical: canonicalOrigin() + "/privacy",
    twitterCard: "summary",
  });

  return (
    <div className="container max-w-3xl py-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-10 text-center">
        <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Shield className="h-8 w-8" />
        </div>
        <h1 className="mt-6 font-serif text-4xl font-bold text-foreground">
          Our Privacy Promise
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
          A short, plain-English summary of how we treat the information you
          share with World Geography Trivia.
        </p>
      </div>

      <div className="space-y-4">
        {sections.map(({ icon: Icon, title, body }) => (
          <Card key={title}>
            <CardContent className="flex gap-4 p-6">
              <div className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-serif text-xl font-bold text-foreground">{title}</h2>
                <p className="mt-1.5 text-muted-foreground leading-relaxed">{body}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-10 flex justify-center">
        <Button asChild variant="outline" data-testid="button-privacy-back-home">
          <Link href="/">Back to Home</Link>
        </Button>
      </div>
    </div>
  );
}
