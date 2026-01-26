import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTranslation } from "react-i18next";

export default function Terms() {
  const { t } = useTranslation();

  const s2List = t("terms.s2List", { returnObjects: true }) as string[];
  const s3List = t("terms.s3List", { returnObjects: true }) as string[];
  const s4List = t("terms.s4List", { returnObjects: true }) as string[];
  const s5List = t("terms.s5List", { returnObjects: true }) as string[];

  return (
    <div className="max-w-4xl mx-auto p-6 pt-8">
      <Card className="bg-white rounded-2xl shadow-lg border border-gray-100">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-gray-900" data-testid="text-terms-title">
            {t("terms.title")}
          </CardTitle>
          <p className="text-gray-600">{t("terms.updated")}</p>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[70vh] pr-4">
            <div className="space-y-6 text-gray-700">
              <section>
                <h2 className="text-xl font-semibold text-gray-900 mb-3">{t("terms.s1Title")}</h2>
                <p>
                  {t("terms.s1Body")}
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-gray-900 mb-3">{t("terms.s2Title")}</h2>
                <p>
                  {t("terms.s2Body")}
                </p>
                <ul className="list-disc pl-6 mt-2">
                  {s2List.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-gray-900 mb-3">{t("terms.s3Title")}</h2>
                <p>
                  {t("terms.s3Body")}
                </p>
                <ul className="list-disc pl-6 mt-2">
                  {s3List.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-gray-900 mb-3">{t("terms.s4Title")}</h2>
                <p>
                  {t("terms.s4Body")}
                </p>
                <ul className="list-disc pl-6 mt-2">
                  {s4List.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-gray-900 mb-3">{t("terms.s5Title")}</h2>
                <p>{t("terms.s5Body")}</p>
                <ul className="list-disc pl-6 mt-2">
                  {s5List.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-gray-900 mb-3">{t("terms.s6Title")}</h2>
                <p>
                  {t("terms.s6Body")}
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-gray-900 mb-3">{t("terms.s7Title")}</h2>
                <p>
                  {t("terms.s7Body")}
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-gray-900 mb-3">{t("terms.s8Title")}</h2>
                <p>
                  {t("terms.s8Body")}
                </p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-gray-900 mb-3">{t("terms.s9Title")}</h2>
                <p>
                  {t("terms.s9Body")}
                </p>
              </section>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
