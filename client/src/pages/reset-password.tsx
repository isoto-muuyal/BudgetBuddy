import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Lock, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { resetPasswordSchema, type ResetPasswordInput } from "@shared/schema";
import { useTranslation } from "react-i18next";

export default function ResetPassword() {
  const [, setLocation] = useLocation();
  const [showPassword, setShowPassword] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [resetSuccess, setResetSuccess] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const resetToken = params.get("token");
    setToken(resetToken);
  }, []);

  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      token: "",
      newPassword: "",
    },
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (data: ResetPasswordInput) => {
      const response = await apiRequest("POST", "/api/auth/reset-password", data);
      return response.json();
    },
    onSuccess: (data) => {
      setResetSuccess(true);
      toast({
        title: t("reset.successTitle"),
        description: data.message || t("reset.successDesc"),
      });
      setTimeout(() => {
        setLocation("/login");
      }, 2000);
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ResetPasswordInput) => {
    if (!token) {
      toast({
        title: t("common.error"),
        description: t("reset.invalidToken"),
        variant: "destructive",
      });
      return;
    }

    resetPasswordMutation.mutate({ ...data, token });
  };

  if (!token) {
    return (
      <div className="max-w-md mx-auto p-4 pt-8">
        <Card className="bg-white rounded-2xl shadow-xl border border-gray-100">
          <CardContent className="p-8">
            <div className="text-center">
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{t("reset.invalidTitle")}</h2>
              <p className="text-gray-600 mb-6">
                {t("reset.invalidDesc")}
              </p>
              <Link href="/forgot-password" className="text-brand-blue hover:text-brand-dark font-medium">
                {t("reset.requestLink")}
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-4 pt-8">
      <Card className="bg-white rounded-2xl shadow-xl border border-gray-100" data-testid="card-reset-password">
        <CardContent className="p-8">
          <div className="text-center mb-8">
            <div className="gradient-brand w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Lock className="text-white text-2xl" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2" data-testid="text-reset-password-title">
              {t("reset.title")}
            </h2>
            <p className="text-gray-600" data-testid="text-reset-password-description">
              {resetSuccess
                ? t("reset.successDesc")
                : t("reset.description")}
            </p>
          </div>

          {!resetSuccess ? (
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="newPassword"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t("reset.password")}</FormLabel>
                      <FormControl>
                        <div className="relative">
                          <Input
                            {...field}
                            type={showPassword ? "text" : "password"}
                            placeholder={t("reset.password")}
                            className="w-full px-4 py-3 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-blue focus:border-transparent transition-all"
                            data-testid="input-password"
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
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

                <Button
                  type="submit"
                  className="w-full bg-blue-400 text-white py-3 rounded-lg font-medium hover:bg-blue-600 transition-colors"
                  disabled={resetPasswordMutation.isPending}
                  data-testid="button-submit"
                >
                  {resetPasswordMutation.isPending ? t("reset.submitting") : t("reset.submit")}
                </Button>
              </form>
            </Form>
          ) : (
            <div className="text-center space-y-4">
              <p className="text-gray-600" data-testid="text-reset-success">
                {t("reset.redirecting")}
              </p>
            </div>
          )}

          <div className="text-center mt-6">
            <Link href="/login" className="text-brand-blue hover:text-brand-dark font-medium" data-testid="link-back-to-login">
              {t("reset.back")}
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
