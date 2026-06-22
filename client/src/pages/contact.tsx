import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { contactFormSchema, type ContactFormInput } from "@shared/schema";
import { useTranslation } from "react-i18next";

export default function Contact() {
  const [messageSent, setMessageSent] = useState(false);
  const { toast } = useToast();
  const { t } = useTranslation();

  const form = useForm<ContactFormInput>({
    resolver: zodResolver(contactFormSchema),
    defaultValues: {
      name: "",
      email: "",
      subject: "",
      message: "",
    },
  });

  const contactMutation = useMutation({
    mutationFn: async (data: ContactFormInput) => {
      const response = await apiRequest("POST", "/api/contact", data);
      return response.json();
    },
    onSuccess: () => {
      setMessageSent(true);
      form.reset();
      toast({
        title: t("contact.successTitle"),
        description: t("contact.successBody"),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t("contact.errorTitle"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ContactFormInput) => {
    contactMutation.mutate(data);
  };

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#5b5c67] px-4 py-8">
      <div className="max-w-md mx-auto">
        <Card className="border-white/10 bg-[#202133] text-white shadow-xl" data-testid="card-contact">
          <CardContent className="p-8">
            <div className="text-center mb-8">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-md bg-white/10 text-amber-400">
                <Mail className="h-8 w-8" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2" data-testid="text-contact-title">
                {t("contact.title")}
              </h2>
              <p className="text-slate-300" data-testid="text-contact-description">
                {messageSent ? t("contact.successBody") : t("contact.subtitle")}
              </p>
            </div>

            {!messageSent ? (
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-300">{t("contact.name")}</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="text"
                            placeholder={t("contact.name")}
                            className="w-full rounded-lg border border-white/10 bg-[#171827] px-4 py-3 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-amber-400"
                            data-testid="input-name"
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
                        <FormLabel className="text-slate-300">{t("contact.email")}</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="email"
                            placeholder={t("contact.email")}
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
                    name="subject"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-300">{t("contact.subject")}</FormLabel>
                        <FormControl>
                          <Input
                            {...field}
                            type="text"
                            placeholder={t("contact.subject")}
                            className="w-full rounded-lg border border-white/10 bg-[#171827] px-4 py-3 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-amber-400"
                            data-testid="input-subject"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="message"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-slate-300">{t("contact.message")}</FormLabel>
                        <FormControl>
                          <Textarea
                            {...field}
                            placeholder={t("contact.message")}
                            rows={5}
                            className="w-full rounded-lg border border-white/10 bg-[#171827] px-4 py-3 text-white placeholder:text-slate-500 focus:ring-2 focus:ring-amber-400"
                            data-testid="input-message"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <Button
                    type="submit"
                    className="w-full rounded-lg bg-amber-500 py-3 font-medium text-slate-950 hover:bg-amber-400 transition-colors"
                    disabled={contactMutation.isPending}
                    data-testid="button-submit"
                  >
                    {contactMutation.isPending ? t("contact.submitting") : t("contact.submit")}
                  </Button>
                </form>
              </Form>
            ) : (
              <Button
                onClick={() => setMessageSent(false)}
                variant="outline"
                className="w-full border-white/10 bg-transparent text-white hover:bg-white/10"
                data-testid="button-send-another"
              >
                {t("contact.sendAnother")}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
