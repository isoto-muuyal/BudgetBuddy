import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Shield } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function Privacy() {
  const { t } = useTranslation();
  const s2List = t("privacy.s2List", { returnObjects: true }) as string[];

  return (
    <div className="max-w-4xl mx-auto p-6 pt-8">
      <Card className="bg-white rounded-2xl shadow-lg border border-gray-100">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-gray-900 flex items-center" data-testid="text-privacy-title">
            <Shield className="mr-3 text-green-500" />
            {t("privacy.title")}
          </CardTitle>
          <p className="text-gray-600">{t("privacy.updated")}</p>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[70vh] pr-4">
            <div className="space-y-6 text-gray-700">
              <section>
                <h2 className="text-xl font-semibold text-gray-900 mb-3">{t("privacy.s1Title")}</h2>
                <p>{t("privacy.s1Body")}</p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-gray-900 mb-3">{t("privacy.s2Title")}</h2>
                <p>{t("privacy.s2Body")}</p>
                <ul className="list-disc pl-6 mt-2">
                  {s2List.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-gray-900 mb-3">{t("privacy.s3Title")}</h2>
                <p>{t("privacy.s3Body")}</p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-gray-900 mb-3">{t("privacy.s4Title")}</h2>
                <p>{t("privacy.s4Body")}</p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-gray-900 mb-3">{t("privacy.s5Title")}</h2>
                <p>{t("privacy.s5Body")}</p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-gray-900 mb-3">{t("privacy.s6Title")}</h2>
                <p>{t("privacy.s6Body")}</p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-gray-900 mb-3">{t("privacy.s7Title")}</h2>
                <p>{t("privacy.s7Body")}</p>
              </section>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
