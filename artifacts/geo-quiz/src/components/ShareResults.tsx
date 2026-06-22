import { useEffect, useState } from "react";
import { Share2, Copy, Check } from "lucide-react";
import { SiX, SiFacebook, SiWhatsapp } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { canonicalOrigin } from "@/hooks/usePageMeta";

interface ShareResultsProps {
  quizId: number;
  quizTitle: string;
  score: number;
  totalQuestions: number;
  percentage: number;
}

export function ShareResults({
  quizId,
  quizTitle,
  score,
  totalQuestions,
  percentage,
}: ShareResultsProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [canNativeShare, setCanNativeShare] = useState(false);

  useEffect(() => {
    setCanNativeShare(
      typeof (navigator as Navigator & { share?: unknown }).share === "function",
    );
  }, []);

  const url = `${canonicalOrigin()}/quiz/${quizId}`;
  const text = `I scored ${score}/${totalQuestions} (${percentage}%) on the ${quizTitle} quiz at World Geography Trivia. Can you beat my score?`;
  const textWithUrl = `${text} ${url}`;

  const openShare = (shareUrl: string) => {
    window.open(shareUrl, "_blank", "noopener,noreferrer");
  };

  const handleNativeShare = async () => {
    try {
      const nav = navigator as Navigator & {
        share?: (data: ShareData) => Promise<void>;
      };
      if (typeof nav.share === "function") {
        await nav.share({ title: "World Geography Trivia", text, url });
      }
    } catch {
      // user cancelled or share failed; ignore
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(textWithUrl);
      setCopied(true);
      toast({
        title: "Copied!",
        description: "Your result and quiz link are in your clipboard.",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({
        title: "Could not copy",
        description: "Please copy the link manually from the address bar.",
        variant: "destructive",
      });
    }
  };

  const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`;
  const facebookUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`;
  const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(textWithUrl)}`;

  return (
    <div className="text-center">
      <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground mb-4">
        Share your result
      </p>
      <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3">
        {canNativeShare && (
          <Button onClick={handleNativeShare} className="px-5">
            <Share2 className="mr-2 h-4 w-4" /> Share
          </Button>
        )}
        <Button
          variant="outline"
          size="icon"
          onClick={() => openShare(twitterUrl)}
          aria-label="Share on X"
          title="Share on X"
        >
          <SiX className="h-4 w-4" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => openShare(facebookUrl)}
          aria-label="Share on Facebook"
          title="Share on Facebook"
          className="text-[#1877F2]"
        >
          <SiFacebook className="h-5 w-5" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={() => openShare(whatsappUrl)}
          aria-label="Share on WhatsApp"
          title="Share on WhatsApp"
          className="text-[#25D366]"
        >
          <SiWhatsapp className="h-5 w-5" />
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={handleCopy}
          aria-label="Copy result and link"
          title="Copy result and link"
        >
          {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  );
}
