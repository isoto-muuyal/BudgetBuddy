import { useState } from "react";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { forgotPasswordSchema, type ForgotPasswordInput } from "@shared/schema";
import { useTranslation } from "react-i18next";

export default function ForgotPassword() {
  const [emailSent, setEmailSent] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();

  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: {
      email: "",
    },
  });

  const forgotPasswordMutation = useMutation({
    mutationFn: async (data: ForgotPasswordInput) => {
      const response = await apiRequest("POST", "/api/auth/forgot-password", data);
      return response.json();
    },
    onSuccess: (data) => {
      setEmailSent(true);
      toast({
        title: t("forgot.emailSent"),
        description: data.message,
      });
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ForgotPasswordInput) => {
    forgotPasswordMutation.mutate(data);
  };

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#5b5c67] px-4 py-8">
    <div className="max-w-md mx-auto">
      <Card className="border-white/10 bg-[#202133] text-white shadow-xl" data-testid="card-forgot-password">
        <CardContent className="p-8">
          <div className="text-center mb-8">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-md bg-white/10 text-amber-400">
              <Mail className="h-8 w-8" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2" data-testid="text-forgot-password-title">
              {t("forgot.title")}
            </h2>
            <p className="text-slate-300" data-testid="text-forgot-password-description">
              {emailSent
                ? t("forgot.descSent")
                : t("forgot.descPrompt")}
            </p>
          </div>

          {!emailSent ? (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                    <FormLabel className="text-slate-300">{t("forgot.email")}</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="email"
                          placeholder={t("forgot.email")}
                          className="w-full rounded-lg border border-white/10 bg-[#171827] px-4 py-3 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-amber-400"
                          data-testid="input-email"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full rounded-lg bg-amber-500 py-3 font-medium text-slate-950 hover:bg-amber-400 transition-colors"
                  disabled={forgotPasswordMutation.isPending}
                  data-testid="button-submit"
                >
                  {forgotPasswordMutation.isPending ? t("forgot.submitting") : t("forgot.submit")}
                </Button>
              </form>
            </Form>
          ) : (
            <div className="text-center space-y-4">
              <p className="text-slate-300" data-testid="text-email-sent">
                {t("forgot.sentBody")}
              </p>
              <Button
                onClick={() => setEmailSent(false)}
                variant="outline"
                className="w-full border-white/10 bg-transparent text-white hover:bg-white/10"
                data-testid="button-send-another"
              >
                {t("forgot.sendAnother")}
              </Button>
            </div>
          )}

          <div className="text-center mt-6">
            <Link href="/login" className="font-medium text-amber-300 hover:text-amber-200" data-testid="link-back-to-login">
              {t("forgot.back")}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
    </main>
  );
}
