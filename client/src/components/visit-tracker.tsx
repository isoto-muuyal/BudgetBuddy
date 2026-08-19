import { useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { getAuthToken } from "@/lib/queryClient";

const VISITOR_ID_KEY = "bw_visitor_id";

function getVisitorId(): string {
  try {
    const existing = localStorage.getItem(VISITOR_ID_KEY);
    if (existing) {
      return existing;
    }
    const generated = crypto.randomUUID();
    localStorage.setItem(VISITOR_ID_KEY, generated);
    return generated;
  } catch {
    return "";
  }
}

function getLoggedInUserIdentifier(): string {
  const token = getAuthToken();
  if (!token) {
    return "";
  }

  try {
    const payload = JSON.parse(atob(token.split(".")[1] || ""));
    if (typeof payload.email === "string" && payload.email) {
      return payload.email;
    }
    if (typeof payload.userId === "string" && payload.userId) {
      return payload.userId;
    }
  } catch {
    return "";
  }

  return "";
}

function sendVisit(payload: { page: string; button?: string; section?: string }) {
  if (payload.page.startsWith("/admin")) {
    return;
  }

  const body = JSON.stringify({
    ...payload,
    userIdentifier: getLoggedInUserIdentifier(),
    visitorId: getVisitorId(),
  });

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
      if (!location.startsWith("/admin")) {
        sendVisit({ page: location, section: "page-enter" });
      }
    }
  }, [location]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const clickable = target?.closest("button, a, [role='button']");

      if (!clickable) {
        return;
      }

      if (window.location.pathname.startsWith("/admin")) {
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
