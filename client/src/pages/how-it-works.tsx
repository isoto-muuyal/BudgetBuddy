import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserPlus, Upload, PieChart, TrendingUp, BadgeInfo } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";

type HowItWorksContent = {
  title: string;
  subtitle: string;
  step1Title: string;
  step1Body: string;
  step2Title: string;
  step2Body: string;
  step3Title: string;
  step3Body: string;
  step4Title: string;
  step4Body: string;
  step5Title: string;
  step5Body: string;
  ctaTitle: string;
  ctaBody: string;
  ctaButton: string;
};

export default function HowItWorks() {
  const { t } = useTranslation();
  const { data: page } = useQuery<{ content: HowItWorksContent }>({
    queryKey: ["/api/content/how-it-works"],
  });

  const c = page?.content;
  const get = (key: keyof HowItWorksContent, fallbackKey: string) => c?.[key] ?? t(fallbackKey);

  const steps = [
    { icon: UserPlus, title: get("step1Title", "howItWorks.step1Title"), body: get("step1Body", "howItWorks.step1Body"), color: "text-blue-500" },
    { icon: Upload, title: get("step2Title", "howItWorks.step2Title"), body: get("step2Body", "howItWorks.step2Body"), color: "text-purple-500" },
    { icon: PieChart, title: get("step3Title", "howItWorks.step3Title"), body: get("step3Body", "howItWorks.step3Body"), color: "text-green-500" },
    { icon: TrendingUp, title: get("step4Title", "howItWorks.step4Title"), body: get("step4Body", "howItWorks.step4Body"), color: "text-amber-500" },
    { icon: BadgeInfo, title: get("step5Title", "howItWorks.step5Title"), body: get("step5Body", "howItWorks.step5Body"), color: "text-amber-500" },
  ];

  return (
    <div className="max-w-4xl mx-auto p-6 pt-8">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-white mb-4" data-testid="text-how-it-works-title">
          {get("title", "howItWorks.title")}
        </h1>
        <p className="text-xl text-slate-200 max-w-2xl mx-auto" data-testid="text-how-it-works-subtitle">
          {get("subtitle", "howItWorks.subtitle")}
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 mb-12">
        {steps.map((step) => (
          <Card key={step.title} className="bg-white rounded-2xl shadow-lg border border-gray-100">
            <CardHeader>
              <CardTitle className="flex items-center text-xl font-semibold text-gray-900">
                <step.icon className={`mr-3 ${step.color}`} />
                {step.title}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-gray-600">{step.body}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-2xl shadow-lg">
        <CardContent className="p-8 text-center">
          <h2 className="text-2xl font-bold text-gray-900 mb-4" data-testid="text-how-it-works-cta-title">
            {get("ctaTitle", "howItWorks.ctaTitle")}
          </h2>
          <p className="text-gray-700 mb-6" data-testid="text-how-it-works-cta-body">
            {get("ctaBody", "howItWorks.ctaBody")}
          </p>
          <Link href="/signup" data-testid="link-get-started">
            <Button className="bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors">
              {get("ctaButton", "howItWorks.ctaButton")}
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
