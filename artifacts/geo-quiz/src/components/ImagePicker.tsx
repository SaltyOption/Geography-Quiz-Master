import { useGetImageGallery } from "@workspace/api-client-react";
import { Loader2, Check } from "lucide-react";
import { ResponsiveImage } from "@/components/ResponsiveImage";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

/**
 * Visual gallery of the locally hosted optimized images (/regions/,
 * /landmarks/) that have all of their responsive variants on disk. Only these
 * are returned by the server, so any thumbnail an admin can click is guaranteed
 * to be safe to save (no broken-image risk). Selecting a thumbnail calls
 * onSelect with the stored path (e.g. "/landmarks/pyramids-giza.jpg").
 *
 * Reusable across the admin image forms (course covers today; category/question
 * images later).
 */
export function ImagePicker({
  value,
  onSelect,
}: {
  value: string;
  onSelect: (url: string) => void;
}) {
  const { data, isLoading, isError } = useGetImageGallery();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-10">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (isError || !data || data.groups.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No hosted images are available to pick from.
      </p>
    );
  }

  return (
    <ScrollArea className="h-72 rounded-md border">
      <div className="space-y-5 p-3">
        {data.groups.map((group) => (
          <div key={group.prefix}>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {group.label}
            </p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {group.images.map((img) => {
                const selected = img.url === value;
                return (
                  <button
                    key={img.url}
                    type="button"
                    onClick={() => onSelect(img.url)}
                    title={img.name}
                    data-testid={`image-option-${img.url}`}
                    aria-pressed={selected}
                    className={cn(
                      "group relative overflow-hidden rounded-md border-2 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                      selected
                        ? "border-primary ring-2 ring-primary/30"
                        : "border-transparent hover:border-muted-foreground/40",
                    )}
                  >
                    <div className="aspect-video w-full bg-muted">
                      <ResponsiveImage
                        src={img.url}
                        alt={img.name}
                        sizes="(max-width: 640px) 33vw, 160px"
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                    </div>
                    {selected && (
                      <span className="absolute right-1 top-1 rounded-full bg-primary p-0.5 text-primary-foreground">
                        <Check className="h-3 w-3" />
                      </span>
                    )}
                    <span className="block truncate px-1 py-0.5 text-center text-[10px] text-muted-foreground">
                      {img.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
