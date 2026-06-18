import { useState, type FormEvent } from "react";
import { Link } from "wouter";
import {
  useSubmitContactMessage,
  type SubmitContactMessageBody,
  SubmitContactMessageBodyReason,
} from "@workspace/api-client-react";
import { usePageMeta, canonicalOrigin } from "@/hooks/usePageMeta";
import { Mail, Send, CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";

const reasonOptions = Object.values(SubmitContactMessageBodyReason);

export default function ContactPage() {
  usePageMeta({
    title: "Contact Us",
    description:
      "Get in touch with World Geography Trivia. Report a quiz correction, suggest a new quiz, share feedback, or ask about partnerships.",
    canonical: canonicalOrigin() + "/contact",
    twitterCard: "summary",
  });

  const { toast } = useToast();
  const submit = useSubmitContactMessage();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [reason, setReason] = useState<string>("");
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !message.trim()) return;

    const data: SubmitContactMessageBody = {
      name: name.trim(),
      email: email.trim(),
      message: message.trim(),
    };
    if (reason) {
      data.reason = reason as SubmitContactMessageBodyReason;
    }

    try {
      await submit.mutateAsync({ data });
      setSent(true);
    } catch {
      toast({
        title: "Something went wrong",
        description: "Your message could not be sent. Please try again.",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setName("");
    setEmail("");
    setReason("");
    setMessage("");
    setSent(false);
  };

  return (
    <div className="container max-w-2xl py-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="mb-10 text-center">
        <div className="mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Mail className="h-8 w-8" />
        </div>
        <h1 className="mt-6 font-serif text-4xl font-bold text-foreground">
          Get in Touch
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-lg text-muted-foreground">
          Spotted a mistake, have a quiz idea, or just want to say hello? Send us
          a message and we'll get back to you.
        </p>
      </div>

      {sent ? (
        <Card>
          <CardContent className="flex flex-col items-center py-14 text-center">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
              <CheckCircle2 className="h-7 w-7" />
            </div>
            <h2 className="mt-5 font-serif text-2xl font-bold text-foreground">
              Message sent!
            </h2>
            <p className="mt-2 max-w-sm text-muted-foreground">
              Thanks for reaching out. We've received your message and will be in
              touch soon.
            </p>
            <div className="mt-6 flex gap-3">
              <Button
                variant="outline"
                onClick={resetForm}
                data-testid="button-contact-send-another"
              >
                Send another message
              </Button>
              <Button asChild>
                <Link href="/">Back to Home</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-6 sm:p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="contact-name">Name</Label>
                <Input
                  id="contact-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  maxLength={100}
                  placeholder="Your name"
                  data-testid="input-contact-name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact-email">Email address</Label>
                <Input
                  id="contact-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  maxLength={200}
                  placeholder="you@example.com"
                  data-testid="input-contact-email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact-reason">
                  Reason for contacting{" "}
                  <span className="text-muted-foreground font-normal">
                    (optional)
                  </span>
                </Label>
                <Select value={reason} onValueChange={setReason}>
                  <SelectTrigger
                    id="contact-reason"
                    data-testid="select-contact-reason"
                  >
                    <SelectValue placeholder="Select a reason" />
                  </SelectTrigger>
                  <SelectContent>
                    {reasonOptions.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact-message">Message</Label>
                <Textarea
                  id="contact-message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                  maxLength={5000}
                  rows={6}
                  placeholder="How can we help?"
                  data-testid="input-contact-message"
                />
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={submit.isPending}
                data-testid="button-contact-submit"
              >
                {submit.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Send className="mr-2 h-4 w-4" />
                )}
                Send message
              </Button>
            </form>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
