import { useEffect, useState } from "react";
import { Link } from "wouter";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";

type VerificationState = "loading" | "success" | "error";

export default function VerifyEmail() {
  const [state, setState] = useState<VerificationState>("loading");
  const [message, setMessage] = useState("Verifying your email address...");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");

    if (!token) {
      setState("error");
      setMessage("This verification link is missing a token.");
      return;
    }

    let cancelled = false;

    async function verifyEmail() {
      try {
        const response = await apiRequest("POST", "/api/auth/verify-email", { token });
        const data = await response.json();
        if (!cancelled) {
          setState("success");
          setMessage(data.message || "Email verified successfully.");
        }
      } catch (error) {
        if (!cancelled) {
          setState("error");
          setMessage(error instanceof Error ? error.message : "Email verification failed.");
        }
      }
    }

    verifyEmail();

    return () => {
      cancelled = true;
    };
  }, []);

  const isLoading = state === "loading";
  const isSuccess = state === "success";

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#5b5c67] px-4 py-8">
      <div className="max-w-md mx-auto">
        <Card className="border-white/10 bg-[#202133] text-white shadow-xl" data-testid="card-verify-email">
          <CardContent className="p-8">
            <div className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-md bg-white/10 text-amber-400">
                {isLoading ? (
                  <Loader2 className="h-8 w-8 animate-spin" />
                ) : isSuccess ? (
                  <CheckCircle2 className="h-8 w-8" />
                ) : (
                  <XCircle className="h-8 w-8" />
                )}
              </div>
              <h2 className="text-2xl font-bold text-white mb-2" data-testid="text-verify-email-title">
                {isLoading ? "Verifying Email" : isSuccess ? "Email Verified" : "Verification Failed"}
              </h2>
              <p className="text-slate-300 mb-6" data-testid="text-verify-email-message">
                {message}
              </p>
              <Button asChild className="w-full rounded-lg bg-amber-500 py-3 font-medium text-slate-950 hover:bg-amber-400">
                <Link href="/login">{isSuccess ? "Sign in" : "Back to sign in"}</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
