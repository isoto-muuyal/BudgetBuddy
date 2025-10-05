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

export default function ForgotPassword() {
  const [emailSent, setEmailSent] = useState(false);
  const { toast } = useToast();

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
        title: "Email Sent",
        description: data.message,
      });
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ForgotPasswordInput) => {
    forgotPasswordMutation.mutate(data);
  };

  return (
    <div className="max-w-md mx-auto p-4 pt-8">
      <Card className="bg-white rounded-2xl shadow-xl border border-gray-100" data-testid="card-forgot-password">
        <CardContent className="p-8">
          <div className="text-center mb-8">
            <div className="gradient-brand w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Mail className="text-white text-2xl" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2" data-testid="text-forgot-password-title">
              Forgot Password?
            </h2>
            <p className="text-gray-600" data-testid="text-forgot-password-description">
              {emailSent
                ? "Check your email for a password reset link"
                : "Enter your email address and we'll send you a link to reset your password"}
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
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="email"
                          placeholder="Enter your email"
                          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-blue focus:border-transparent transition-all"
                          data-testid="input-email"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button
                  type="submit"
                  className="w-full bg-blue-400 text-white py-3 rounded-lg font-medium hover:bg-blue-600 transition-colors"
                  disabled={forgotPasswordMutation.isPending}
                  data-testid="button-submit"
                >
                  {forgotPasswordMutation.isPending ? "Sending..." : "Send Reset Link"}
                </Button>
              </form>
            </Form>
          ) : (
            <div className="text-center space-y-4">
              <p className="text-gray-600" data-testid="text-email-sent">
                We've sent a password reset link to your email address. Please check your inbox and follow the instructions.
              </p>
              <Button
                onClick={() => setEmailSent(false)}
                variant="outline"
                className="w-full"
                data-testid="button-send-another"
              >
                Send Another Link
              </Button>
            </div>
          )}

          <div className="text-center mt-6">
            <Link href="/login" className="text-brand-blue hover:text-brand-dark font-medium" data-testid="link-back-to-login">
              Back to Login
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
