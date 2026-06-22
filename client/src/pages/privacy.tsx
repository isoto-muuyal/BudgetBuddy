import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Shield } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";

type PrivacyContent = {
  title: string;
  updated: string;
  s1Title: string;
  s1Body: string;
  s2Title: string;
  s2Body: string;
  s2List: string[];
  s3Title: string;
  s3Body: string;
  s4Title: string;
  s4Body: string;
  s5Title: string;
  s5Body: string;
  s6Title: string;
  s6Body: string;
  s7Title: string;
  s7Body: string;
};

export default function Privacy() {
  const { t } = useTranslation();
  const { data: page } = useQuery<{ content: PrivacyContent }>({
    queryKey: ["/api/content/privacy"],
  });

  const c = page?.content;
  const get = (key: keyof Omit<PrivacyContent, "s2List">, fallbackKey: string) => c?.[key] ?? t(fallbackKey);
  const s2List = c?.s2List ?? (t("privacy.s2List", { returnObjects: true }) as string[]);

  return (
    <div className="max-w-4xl mx-auto p-6 pt-8">
      <Card className="bg-white rounded-2xl shadow-lg border border-gray-100">
        <CardHeader>
          <CardTitle className="text-3xl font-bold text-gray-900 flex items-center" data-testid="text-privacy-title">
            <Shield className="mr-3 text-green-500" />
            {get("title", "privacy.title")}
          </CardTitle>
          <p className="text-gray-600">{get("updated", "privacy.updated")}</p>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[70vh] pr-4">
            <div className="space-y-6 text-gray-700">
              <section>
                <h2 className="text-xl font-semibold text-gray-900 mb-3">{get("s1Title", "privacy.s1Title")}</h2>
                <p>{get("s1Body", "privacy.s1Body")}</p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-gray-900 mb-3">{get("s2Title", "privacy.s2Title")}</h2>
                <p>{get("s2Body", "privacy.s2Body")}</p>
                <ul className="list-disc pl-6 mt-2">
                  {s2List.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-gray-900 mb-3">{get("s3Title", "privacy.s3Title")}</h2>
                <p>{get("s3Body", "privacy.s3Body")}</p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-gray-900 mb-3">{get("s4Title", "privacy.s4Title")}</h2>
                <p>{get("s4Body", "privacy.s4Body")}</p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-gray-900 mb-3">{get("s5Title", "privacy.s5Title")}</h2>
                <p>{get("s5Body", "privacy.s5Body")}</p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-gray-900 mb-3">{get("s6Title", "privacy.s6Title")}</h2>
                <p>{get("s6Body", "privacy.s6Body")}</p>
              </section>

              <section>
                <h2 className="text-xl font-semibold text-gray-900 mb-3">{get("s7Title", "privacy.s7Title")}</h2>
                <p>{get("s7Body", "privacy.s7Body")}</p>
              </section>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
