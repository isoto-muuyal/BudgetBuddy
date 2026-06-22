import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { UserPlus, Upload, PieChart, TrendingUp } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function HowItWorks() {
  const { t } = useTranslation();

  const steps = [
    { icon: UserPlus, title: t("howItWorks.step1Title"), body: t("howItWorks.step1Body"), color: "text-blue-500" },
    { icon: Upload, title: t("howItWorks.step2Title"), body: t("howItWorks.step2Body"), color: "text-purple-500" },
    { icon: PieChart, title: t("howItWorks.step3Title"), body: t("howItWorks.step3Body"), color: "text-green-500" },
    { icon: TrendingUp, title: t("howItWorks.step4Title"), body: t("howItWorks.step4Body"), color: "text-amber-500" },
  ];

  return (
    <div className="max-w-4xl mx-auto p-6 pt-8">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4" data-testid="text-how-it-works-title">
          {t("howItWorks.title")}
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto" data-testid="text-how-it-works-subtitle">
          {t("howItWorks.subtitle")}
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
            {t("howItWorks.ctaTitle")}
          </h2>
          <p className="text-gray-700 mb-6" data-testid="text-how-it-works-cta-body">
            {t("howItWorks.ctaBody")}
          </p>
          <Link href="/signup" data-testid="link-get-started">
            <Button className="bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors">
              {t("howItWorks.ctaButton")}
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
