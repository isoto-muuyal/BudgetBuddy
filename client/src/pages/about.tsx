import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Shield, Zap, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";

type AppVersionResponse = {
  id: number;
  version: string;
  updatedAt: string;
};

type AboutContent = {
  title: string;
  subtitle: string;
  smart: string;
  smartBody: string;
  privacy: string;
  privacyBody: string;
  insights: string;
  insightsBody: string;
  built: string;
  builtBody: string;
  ruleTitle: string;
  ruleIntro: string;
  ruleWhy: string;
  ruleWhyBody: string;
  needsTitle: string;
  needsBody: string;
  wantsTitle: string;
  wantsBody: string;
  savingsTitle: string;
  savingsBody: string;
};

export default function About() {
  const { t } = useTranslation();
  const { data: appVersion, isLoading: versionLoading } = useQuery<AppVersionResponse>({
    queryKey: ["/api/version"],
    refetchOnWindowFocus: true,
    staleTime: 0,
  });

  const { data: page } = useQuery<{ content: AboutContent }>({
    queryKey: ["/api/content/about"],
  });

  const c = page?.content;
  const get = (key: keyof AboutContent, fallbackKey: string) => c?.[key] ?? t(fallbackKey);

  const versionLabel = appVersion?.version ?? "0.1.1";
  const updatedLabel = appVersion?.updatedAt
    ? new Date(appVersion.updatedAt).toLocaleString()
    : "Not available";

  return (
    <div className="max-w-4xl mx-auto p-6 pt-8">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-white mb-4" data-testid="text-about-title">
          {get("title", "about.title")}
        </h1>
        <p className="text-xl text-slate-200 max-w-2xl mx-auto" data-testid="text-about-description">
          {get("subtitle", "about.subtitle")}
        </p>
      </div>

      <Card className="bg-white rounded-2xl shadow-lg border border-gray-100 mb-8">
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-gray-900">Build Version</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-gray-800">
            <span className="font-semibold">Current version:</span> {versionLoading ? "Loading..." : versionLabel}
          </p>
          <p className="text-gray-800">
            <span className="font-semibold">Last updated:</span> {versionLoading ? "Loading..." : updatedLabel}
          </p>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-8 mb-12">
        <Card className="bg-white rounded-2xl shadow-lg border border-gray-100">
          <CardHeader>
            <CardTitle className="flex items-center text-xl font-semibold text-gray-900">
              <BarChart3 className="mr-3 text-blue-500" />
              {get("smart", "about.smart")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">
              {get("smartBody", "about.smartBody")}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white rounded-2xl shadow-lg border border-gray-100">
          <CardHeader>
            <CardTitle className="flex items-center text-xl font-semibold text-gray-900">
              <Shield className="mr-3 text-green-500" />
              {get("privacy", "about.privacy")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">
              {get("privacyBody", "about.privacyBody")}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white rounded-2xl shadow-lg border border-gray-100">
          <CardHeader>
            <CardTitle className="flex items-center text-xl font-semibold text-gray-900">
              <Zap className="mr-3 text-yellow-500" />
              {get("insights", "about.insights")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">
              {get("insightsBody", "about.insightsBody")}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white rounded-2xl shadow-lg border border-gray-100">
          <CardHeader>
            <CardTitle className="flex items-center text-xl font-semibold text-gray-900">
              <Users className="mr-3 text-purple-500" />
              {get("built", "about.built")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">
              {get("builtBody", "about.builtBody")}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-2xl shadow-lg">
        <CardContent className="p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">{get("ruleTitle", "about.ruleTitle")}</h2>
          <p className="text-gray-700 mb-4">{get("ruleIntro", "about.ruleIntro")}</p>
          <div className="rounded-xl bg-white/70 border border-blue-100 p-4 mb-6">
            <h3 className="font-semibold text-gray-900 mb-2">{get("ruleWhy", "about.ruleWhy")}</h3>
            <p className="text-sm text-gray-600">{get("ruleWhyBody", "about.ruleWhyBody")}</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="bg-red-100 text-red-800 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-3 text-xl font-bold">
                50%
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">{get("needsTitle", "about.needsTitle")}</h3>
              <p className="text-sm text-gray-600">{get("needsBody", "about.needsBody")}</p>
            </div>
            <div className="text-center">
              <div className="bg-orange-100 text-orange-800 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-3 text-xl font-bold">
                30%
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">{get("wantsTitle", "about.wantsTitle")}</h3>
              <p className="text-sm text-gray-600">{get("wantsBody", "about.wantsBody")}</p>
            </div>
            <div className="text-center">
              <div className="bg-green-100 text-green-800 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-3 text-xl font-bold">
                20%
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">{get("savingsTitle", "about.savingsTitle")}</h3>
              <p className="text-sm text-gray-600">{get("savingsBody", "about.savingsBody")}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
