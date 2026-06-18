import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import {
  useValidateImageUrl,
  getValidateImageUrlQueryKey,
} from "@workspace/api-client-react";

// Mirror of OPTIMIZED_PREFIXES in the API's imageValidation.ts. URLs under
// these prefixes require pre-generated responsive variants.
const OPTIMIZED_PREFIXES = ["/regions/", "/landmarks/"];

function isOptimizedImageUrl(url: string): boolean {
  return OPTIMIZED_PREFIXES.some((p) => url.startsWith(p));
}

function isExternalImageUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
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
 * Inline pre-flight warning for the admin image-URL fields. Surfaces, while the
 * admin types, when:
 *   - an optimized (/regions/, /landmarks/) URL's source file or responsive
 *     variants are not hosted, or
 *   - an external http(s) URL does not resolve to a reachable image.
 * The server-side 400 on save stays authoritative; transient network failures
 * never produce a warning here (server returns reachable=null).
 */
export function ImageUrlWarning({ url }: { url: string }) {
  const trimmed = url.trim();
  const debouncedUrl = useDebouncedValue(trimmed, 500);
  const enabled =
    isOptimizedImageUrl(debouncedUrl) || isExternalImageUrl(debouncedUrl);

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

  if (!enabled || !data) return null;

  const notHosted = data.missing.length > 0;
  const unreachable = data.reachable === false;
  if (!notHosted && !unreachable) return null;

  return (
    <div
      className="mt-2 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-200"
      data-testid="warning-image-not-hosted"
    >
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <div>
        <p className="font-medium">
          {notHosted
            ? "This image isn't hosted yet."
            : "This image URL can't be reached."}
        </p>
        <p className="mt-0.5">
          {data.message ??
            "Check that the URL is correct, or host the image locally."}{" "}
          Saving will be rejected until the image is reachable.
        </p>
      </div>
    </div>
  );
}
