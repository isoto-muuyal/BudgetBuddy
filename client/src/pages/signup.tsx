import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Chrome, HandCoins, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { signupSchema, type SignupUser } from "@shared/schema";
import { useTranslation } from "react-i18next";

export default function Signup() {
  const [, setLocation] = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();

  const form = useForm<SignupUser>({
    resolver: zodResolver(signupSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: "",
    },
  });

  const signupMutation = useMutation({
    mutationFn: async (data: SignupUser) => {
      const response = await apiRequest("POST", "/api/auth/signup", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: t("signup.successTitle"),
        description: t("signup.successDesc"),
      });
      setLocation("/login");
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: SignupUser) => {
    signupMutation.mutate(data);
  };

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#5b5c67] px-4 py-8">
    <div className="max-w-md mx-auto">
      <Card className="border-white/10 bg-[#202133] text-white shadow-xl" data-testid="card-signup">
        <CardContent className="p-8">
          <div className="text-center mb-8">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-md bg-white/10 text-amber-400">
              <HandCoins className="h-8 w-8" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2" data-testid="text-signup-title">
              {t("signup.title")}
            </h2>
            <p className="text-slate-300" data-testid="text-signup-description">
              {t("signup.description")}
            </p>
          </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-300">{t("signup.fullName")}</FormLabel>
                    <FormControl>
                        <Input
                          {...field}
                          type="text"
                          placeholder={t("signup.fullName")}
                        className="w-full rounded-lg border border-white/10 bg-[#171827] px-4 py-3 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-amber-400"
                        data-testid="input-fullname"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-300">{t("signup.email")}</FormLabel>
                    <FormControl>
                        <Input
                          {...field}
                          type="email"
                          placeholder={t("signup.email")}
                        className="w-full rounded-lg border border-white/10 bg-[#171827] px-4 py-3 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-amber-400"
                        data-testid="input-email"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-slate-300">{t("signup.password")}</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          {...field}
                          type={showPassword ? "text" : "password"}
                          placeholder={t("signup.passwordPlaceholder")}
                          className="w-full rounded-lg border border-white/10 bg-[#171827] px-4 py-3 pr-12 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-amber-400"
                          data-testid="input-password"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                          onClick={() => setShowPassword(!showPassword)}
                          data-testid="button-toggle-password"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="text-xs text-slate-400">
                {t("signup.termsNote")}
              </div>

              <Button
                type="submit"
                className="w-full rounded-lg bg-amber-500 py-3 font-medium text-slate-950 hover:bg-amber-400 transition-colors"
                disabled={signupMutation.isPending}
                data-testid="button-submit"
              >
                {signupMutation.isPending ? t("signup.submitting") : t("signup.submit")}
              </Button>
            </form>
          </Form>

          <div className="my-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-white/10" />
            <span className="text-xs text-slate-500">{t("common.or")}</span>
            <div className="h-px flex-1 bg-white/10" />
          </div>

          <Button
            variant="outline"
            className="w-full border border-white/10 bg-transparent text-white hover:bg-white/10"
            onClick={() => {
              window.location.href = "/api/auth/google";
            }}
            data-testid="button-google-signup"
          >
            <Chrome className="mr-2 h-4 w-4" />
            {t("signup.google")}
          </Button>

          <div className="text-center mt-6">
            <span className="text-slate-300">{t("signup.haveAccount")} </span>
            <Link href="/login" className="font-medium text-amber-300 hover:text-amber-200" data-testid="link-login">
              {t("signup.login")}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
    </main>
  );
}
