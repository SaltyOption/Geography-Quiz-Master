import { useRef } from "react";
import {
  Bold,
  Italic,
  Heading,
  Code,
  Link as LinkIcon,
  List,
  ListOrdered,
} from "lucide-react";
import { renderMarkdown } from "@workspace/markdown";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const isMac =
  typeof navigator !== "undefined" && /Mac|iPhone|iPad|iPod/.test(navigator.platform);
const modKey = isMac ? "⌘" : "Ctrl";

export interface MarkdownTextareaProps {
  value: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  /** Forwarded so callers (e.g. react-hook-form) can also grab the element. */
  inputRef?: (el: HTMLTextAreaElement | null) => void;
  id?: string;
  placeholder?: string;
  rows?: number;
  className?: string;
  "data-testid"?: string;
  /** "inline" shows bold/italic/link; "full" adds heading, code and lists. */
  toolbar?: "inline" | "full";
  /** Shows the keyboard-shortcut hint line below the field. */
  showHints?: boolean;
  /** Shows a live rendered Markdown preview beneath the field. */
  showPreview?: boolean;
  /**
   * "stacked" (default) renders a compact preview below the field; "side"
   * renders a full-size preview beside the field on large screens.
   */
  previewLayout?: "stacked" | "side";
}

export function MarkdownTextarea({
  value,
  onChange,
  onBlur,
  inputRef,
  id,
  placeholder,
  rows,
  className,
  toolbar = "inline",
  showHints = true,
  showPreview = false,
  previewLayout = "stacked",
  ...rest
}: MarkdownTextareaProps) {
  const testId = rest["data-testid"];
  const taRef = useRef<HTMLTextAreaElement | null>(null);

  function setValue(next: string, selStart: number, selEnd: number) {
    onChange(next);
    requestAnimationFrame(() => {
      const ta = taRef.current;
      if (!ta) return;
      ta.focus();
      ta.setSelectionRange(selStart, selEnd);
    });
  }

  function applyInline(prefix: string, suffix: string, placeholder: string) {
    const ta = taRef.current;
    if (!ta) return;
    const { selectionStart: start, selectionEnd: end, value: current } = ta;
    const selected = current.slice(start, end) || placeholder;
    const next =
      current.slice(0, start) + prefix + selected + suffix + current.slice(end);
    const selStart = start + prefix.length;
    setValue(next, selStart, selStart + selected.length);
  }

  function applyLink() {
    const ta = taRef.current;
    if (!ta) return;
    const { selectionStart: start, selectionEnd: end, value: current } = ta;
    const label = current.slice(start, end) || "label";
    const urlPlaceholder = "https://example.com";
    const next =
      current.slice(0, start) + `[${label}](${urlPlaceholder})` + current.slice(end);
    const urlStart = start + label.length + 3;
    setValue(next, urlStart, urlStart + urlPlaceholder.length);
  }

  function applyLinePrefix(getPrefix: (index: number) => string) {
    const ta = taRef.current;
    if (!ta) return;
    const { selectionStart: start, selectionEnd: end, value: current } = ta;
    const lineStart = current.lastIndexOf("\n", start - 1) + 1;
    let lineEnd = current.indexOf("\n", end);
    if (lineEnd === -1) lineEnd = current.length;
    const newBlock = current
      .slice(lineStart, lineEnd)
      .split("\n")
      .map((line, index) => getPrefix(index) + line)
      .join("\n");
    const next = current.slice(0, lineStart) + newBlock + current.slice(lineEnd);
    setValue(next, lineStart, lineStart + newBlock.length);
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
    const key = event.key.toLowerCase();
    if (key === "b") {
      event.preventDefault();
      applyInline("**", "**", "bold text");
    } else if (key === "i") {
      event.preventDefault();
      applyInline("*", "*", "italic text");
    } else if (key === "k") {
      event.preventDefault();
      applyLink();
    }
  }

  const sideBySide = showPreview && previewLayout === "side";

  const field = (
    <Textarea
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onBlur}
      onKeyDown={handleKeyDown}
      rows={rows}
      placeholder={placeholder}
      className={cn("font-mono text-sm", className)}
      data-testid={testId}
      ref={(el) => {
        taRef.current = el;
        inputRef?.(el);
      }}
    />
  );

  const preview = showPreview && (
    <div
      className={cn(
        "overflow-auto rounded-md border bg-muted/30",
        sideBySide ? "min-h-[320px] p-4" : "p-3",
      )}
      data-testid={testId ? `${testId}-preview` : undefined}
    >
      <p
        className={cn(
          "text-xs font-medium uppercase tracking-wide text-muted-foreground",
          sideBySide ? "mb-3" : "mb-2",
        )}
      >
        Preview
      </p>
      {value.trim() ? (
        <div
          className={cn(
            "prose prose-stone max-w-none prose-headings:font-bold prose-a:text-primary",
            !sideBySide && "prose-sm",
          )}
          dangerouslySetInnerHTML={{ __html: renderMarkdown(value) }}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          Your formatted text will appear here as you type.
        </p>
      )}
    </div>
  );

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-1 rounded-md border bg-muted/30 p-1">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          title={`Bold (${modKey}+B)`}
          aria-label={`Bold (${modKey}+B)`}
          data-testid="button-format-bold"
          onClick={() => applyInline("**", "**", "bold text")}
        >
          <Bold className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          title={`Italic (${modKey}+I)`}
          aria-label={`Italic (${modKey}+I)`}
          data-testid="button-format-italic"
          onClick={() => applyInline("*", "*", "italic text")}
        >
          <Italic className="h-4 w-4" />
        </Button>
        {toolbar === "full" && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            title="Heading"
            aria-label="Heading"
            data-testid="button-format-heading"
            onClick={() => applyLinePrefix(() => "## ")}
          >
            <Heading className="h-4 w-4" />
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          title="Inline code"
          aria-label="Inline code"
          data-testid="button-format-code"
          onClick={() => applyInline("`", "`", "code")}
        >
          <Code className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          title={`Link (${modKey}+K)`}
          aria-label={`Link (${modKey}+K)`}
          data-testid="button-format-link"
          onClick={applyLink}
        >
          <LinkIcon className="h-4 w-4" />
        </Button>
        {toolbar === "full" && (
          <>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="Bullet list"
              aria-label="Bullet list"
              data-testid="button-format-bullet-list"
              onClick={() => applyLinePrefix(() => "- ")}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              title="Numbered list"
              aria-label="Numbered list"
              data-testid="button-format-numbered-list"
              onClick={() => applyLinePrefix((index) => `${index + 1}. `)}
            >
              <ListOrdered className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>
      {sideBySide ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {field}
          {preview}
        </div>
      ) : (
        <>
          {field}
          {preview}
        </>
      )}
      {showHints && (
        <p className="text-xs text-muted-foreground">
          Markdown supported. Shortcuts:{" "}
          <kbd className="rounded border bg-muted px-1">{modKey}+B</kbd> bold,{" "}
          <kbd className="rounded border bg-muted px-1">{modKey}+I</kbd> italic,{" "}
          <kbd className="rounded border bg-muted px-1">{modKey}+K</kbd> link.
        </p>
      )}
    </div>
  );
}
