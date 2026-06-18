import { useEffect, useState } from "react";
import { Image as ImageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ImagePicker } from "@/components/ImagePicker";
import { ResponsiveImage } from "@/components/ResponsiveImage";

/**
 * A reusable image field that opens the visual {@link ImagePicker} gallery in a
 * dialog so admins can pick a hosted image (guaranteed safe — all responsive
 * variants exist) or fall back to typing any image URL. Shared by the category
 * and question admin forms (course covers use the same picker inline).
 *
 * `value` is the currently stored image path/URL ("" when none). `onChange` is
 * called with the chosen value (or "" when removed). Set `compact` for tight
 * rows (e.g. the inline category tree editor) to render only the trigger button.
 */
export function ImagePickerField({
  value,
  onChange,
  compact = false,
}: {
  value: string;
  onChange: (url: string) => void;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);

  useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  const apply = () => {
    onChange(draft.trim());
    setOpen(false);
  };

  const trigger = (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button type="button" variant="outline" size="sm">
          <ImageIcon className="mr-2 h-4 w-4" />
          {value ? "Change image" : "Choose image"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Choose an image</DialogTitle>
          <DialogDescription>
            Pick a hosted image from the gallery, or enter an image URL.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Hosted images</Label>
            <ImagePicker value={draft} onSelect={setDraft} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="image-picker-url">Or enter an image URL</Label>
            <Input
              id="image-picker-url"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="/landmarks/pyramids-giza.jpg"
              className="font-mono text-xs"
            />
            <p className="text-xs text-muted-foreground">
              Hosted images under /regions/ or /landmarks/ must have their responsive
              variants uploaded, or saving is rejected.
            </p>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button type="button" onClick={apply}>
            Use image
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  if (compact) {
    return (
      <div className="flex items-center gap-2">
        {trigger}
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => onChange("")}
          >
            Remove
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        {value ? (
          <div className="h-12 w-20 shrink-0 overflow-hidden rounded border bg-muted">
            <ResponsiveImage
              src={value}
              alt="Selected image preview"
              className="h-full w-full object-cover"
            />
          </div>
        ) : (
          <div className="flex h-12 w-20 shrink-0 items-center justify-center rounded border border-dashed bg-muted/40 text-muted-foreground">
            <ImageIcon className="h-5 w-5" />
          </div>
        )}
        {trigger}
        {value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground"
            onClick={() => onChange("")}
          >
            Remove
          </Button>
        )}
      </div>
      {value && (
        <p className="break-all font-mono text-xs text-muted-foreground">{value}</p>
      )}
    </div>
  );
}
