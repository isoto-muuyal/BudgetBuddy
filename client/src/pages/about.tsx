import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { BarChart3, Shield, Zap, Users } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function About() {
  const { t } = useTranslation();

  return (
    <div className="max-w-4xl mx-auto p-6 pt-8">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold text-gray-900 mb-4" data-testid="text-about-title">
          {t("about.title")}
        </h1>
        <p className="text-xl text-gray-600 max-w-2xl mx-auto" data-testid="text-about-description">
          {t("about.subtitle")}
        </p>
      </div>

      <div className="grid md:grid-cols-2 gap-8 mb-12">
        <Card className="bg-white rounded-2xl shadow-lg border border-gray-100">
          <CardHeader>
            <CardTitle className="flex items-center text-xl font-semibold text-gray-900">
              <BarChart3 className="mr-3 text-blue-500" />
              {t("about.smart")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">
              {t("about.smartBody")}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white rounded-2xl shadow-lg border border-gray-100">
          <CardHeader>
            <CardTitle className="flex items-center text-xl font-semibold text-gray-900">
              <Shield className="mr-3 text-green-500" />
              {t("about.privacy")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">
              {t("about.privacyBody")}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white rounded-2xl shadow-lg border border-gray-100">
          <CardHeader>
            <CardTitle className="flex items-center text-xl font-semibold text-gray-900">
              <Zap className="mr-3 text-yellow-500" />
              {t("about.insights")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">
              {t("about.insightsBody")}
            </p>
          </CardContent>
        </Card>

        <Card className="bg-white rounded-2xl shadow-lg border border-gray-100">
          <CardHeader>
            <CardTitle className="flex items-center text-xl font-semibold text-gray-900">
              <Users className="mr-3 text-purple-500" />
              {t("about.built")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-gray-600">
              {t("about.builtBody")}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-2xl shadow-lg">
        <CardContent className="p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-4">{t("about.ruleTitle")}</h2>
          <p className="text-gray-700 mb-4">{t("about.ruleIntro")}</p>
          <div className="rounded-xl bg-white/70 border border-blue-100 p-4 mb-6">
            <h3 className="font-semibold text-gray-900 mb-2">{t("about.ruleWhy")}</h3>
            <p className="text-sm text-gray-600">{t("about.ruleWhyBody")}</p>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="bg-red-100 text-red-800 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-3 text-xl font-bold">
                50%
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">{t("about.needsTitle")}</h3>
              <p className="text-sm text-gray-600">{t("about.needsBody")}</p>
            </div>
            <div className="text-center">
              <div className="bg-orange-100 text-orange-800 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-3 text-xl font-bold">
                30%
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">{t("about.wantsTitle")}</h3>
              <p className="text-sm text-gray-600">{t("about.wantsBody")}</p>
            </div>
            <div className="text-center">
              <div className="bg-green-100 text-green-800 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-3 text-xl font-bold">
                20%
              </div>
              <h3 className="font-semibold text-gray-900 mb-2">{t("about.savingsTitle")}</h3>
              <p className="text-sm text-gray-600">{t("about.savingsBody")}</p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
