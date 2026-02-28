import { useEffect, useRef } from "react";
import { useLocation } from "wouter";

function sendVisit(payload: { page: string; button?: string; section?: string }) {
  const body = JSON.stringify(payload);

  if (navigator.sendBeacon) {
    const blob = new Blob([body], { type: "application/json" });
    navigator.sendBeacon("/api/visits/track", blob);
    return;
  }

  fetch("/api/visits/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    credentials: "include",
    keepalive: true,
  }).catch(() => undefined);
}

export default function VisitTracker() {
  const [location] = useLocation();
  const lastPageRef = useRef("");

  useEffect(() => {
    if (lastPageRef.current !== location) {
      lastPageRef.current = location;
      sendVisit({ page: location, section: "page-enter" });
    }
  }, [location]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const clickable = target?.closest("button, a, [role='button']");

      if (!clickable) {
        return;
      }

      const button =
        clickable.getAttribute("data-testid") ||
        clickable.getAttribute("aria-label") ||
        clickable.textContent?.trim() ||
        clickable.tagName.toLowerCase();

      const section =
        clickable.closest("[data-testid]")?.getAttribute("data-testid") ||
        clickable.closest("section, article, nav, main, aside")?.tagName.toLowerCase() ||
        "unknown";

      sendVisit({
        page: window.location.pathname,
        button,
        section,
      });
    };

    window.addEventListener("click", onClick);
    return () => window.removeEventListener("click", onClick);
  }, []);

  return null;
}
