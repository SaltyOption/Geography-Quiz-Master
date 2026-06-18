import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  useValidateImageUrl,
  getValidateImageUrlQueryKey,
} from "@workspace/api-client-react";

// Mirror of OPTIMIZED_PREFIXES in the API's imageValidation.ts. Only URLs under
// these prefixes require pre-generated responsive variants, so we only bother
// the server for those. The server-side 400 on save stays authoritative.
const OPTIMIZED_PREFIXES = ["/regions/", "/landmarks/"];

function isOptimizedImageUrl(url: string): boolean {
  return OPTIMIZED_PREFIXES.some((p) => url.startsWith(p));
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const handle = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(handle);
  }, [value, delayMs]);
  return debounced;
}

/**
 * Inline pre-flight warning for the admin question form. When the entered image
 * URL points under an optimized prefix but its source file or responsive
 * variants are not hosted yet, this surfaces the problem while the admin types
 * — before they hit Save and get a 400 from the server.
 */
export function ImageUrlWarning({ url }: { url: string }) {
  const trimmed = url.trim();
  const debouncedUrl = useDebouncedValue(trimmed, 500);
  const enabled = isOptimizedImageUrl(debouncedUrl);

  const { data } = useValidateImageUrl(
    { url: debouncedUrl },
    {
      query: {
        enabled,
        retry: false,
        staleTime: 60_000,
        queryKey: getValidateImageUrlQueryKey({ url: debouncedUrl }),
      },
    },
  );

  if (!enabled || !data || data.missing.length === 0) return null;

  return (
    <div
      className="mt-2 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200"
      data-testid="warning-image-not-hosted"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <p className="font-medium">This image isn't hosted yet.</p>
        <p className="mt-0.5">
          {data.message ??
            "Upload the source image and regenerate its responsive variants, or correct the URL."}{" "}
          Saving will be rejected until the file and its responsive variants exist.
        </p>
      </div>
    </div>
  );
}
