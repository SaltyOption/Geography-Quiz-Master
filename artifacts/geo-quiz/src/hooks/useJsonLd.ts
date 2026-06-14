import { useEffect } from "react";

const SCRIPT_ID = "json-ld-structured-data";

export function useJsonLd(data: object | null | undefined) {
  useEffect(() => {
    if (!data) return;

    let el = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (!el) {
      el = document.createElement("script");
      el.id = SCRIPT_ID;
      el.type = "application/ld+json";
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify(data);

    return () => {
      const existing = document.getElementById(SCRIPT_ID);
      if (existing) existing.remove();
    };
  }, [JSON.stringify(data)]);
}
