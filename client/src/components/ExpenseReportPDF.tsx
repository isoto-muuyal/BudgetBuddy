import { Document, Page, Text, View, StyleSheet, pdf } from "@react-pdf/renderer";
import i18n from "@/i18n";

interface ExpenseItem {
  description: string;
  amount: number;
  category: string;
  subcategory?: string;
}

interface ReportData {
  user: {
    fullName: string;
    email: string;
  };
  analysis: {
    id: string;
    monthlyIncome: string;
    actualNeeds: string;
    actualWants: string;
    actualSavings: string;
    recommendedNeeds: string;
    recommendedWants: string;
    recommendedSavings: string;
    recommendations: string;
    expenses: ExpenseItem[];
    originalFileName: string;
    uploadDate: string;
  };
}

// Create styles
const styles = StyleSheet.create({
  page: {
    flexDirection: 'column',
    backgroundColor: '#ffffff',
    padding: 30,
    fontFamily: 'Helvetica',
  },
  header: {
    marginBottom: 20,
    borderBottom: 1,
    borderBottomColor: '#e5e7eb',
    paddingBottom: 15,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6b7280',
    marginBottom: 4,
  },
  userInfo: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: '#f9fafb',
    borderRadius: 8,
  },
  userInfoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 8,
  },
  userInfoText: {
    fontSize: 12,
    color: '#4b5563',
    marginBottom: 3,
  },
  section: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 12,
    borderBottom: 1,
    borderBottomColor: '#e5e7eb',
    paddingBottom: 4,
  },
  budgetComparison: {
    flexDirection: 'row',
    marginBottom: 20,
  },
  budgetColumn: {
    flex: 1,
    marginRight: 15,
  },
  budgetColumnTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#374151',
    marginBottom: 10,
    textAlign: 'center',
  },
  budgetItem: {
    marginBottom: 8,
    padding: 10,
    backgroundColor: '#f3f4f6',
    borderRadius: 6,
  },
  budgetItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 3,
  },
  budgetItemLabel: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#374151',
  },
  budgetItemPercent: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  budgetItemAmount: {
    fontSize: 10,
    color: '#6b7280',
  },
  needsColor: { color: '#dc2626' },
  wantsColor: { color: '#ea580c' },
  savingsColor: { color: '#059669' },
  recommendedColor: { color: '#059669' },
  recommendationsBox: {
    padding: 15,
    backgroundColor: '#eff6ff',
    borderRadius: 8,
    marginBottom: 20,
  },
  recommendationsTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#1e40af',
    marginBottom: 8,
  },
  recommendationsText: {
    fontSize: 11,
    color: '#374151',
    lineHeight: 1.6,
  },
  expensesList: {
    marginTop: 10,
  },
  expenseItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    marginBottom: 4,
    backgroundColor: '#f9fafb',
    borderRadius: 6,
  },
  expenseLeft: {
    flex: 2,
  },
  expenseDescription: {
    fontSize: 11,
    color: '#1f2937',
    fontWeight: 'bold',
  },
  expenseSubcategory: {
    fontSize: 9,
    color: '#6b7280',
  },
  expenseRight: {
    flex: 1,
    alignItems: 'flex-end',
  },
  expenseAmount: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#1f2937',
    marginBottom: 2,
  },
  expenseCategory: {
    fontSize: 9,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    color: '#ffffff',
  },
  needsBg: { backgroundColor: '#dc2626' },
  wantsBg: { backgroundColor: '#ea580c' },
  savingsBg: { backgroundColor: '#059669' },
  unclearBg: { backgroundColor: '#6b7280' },
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 30,
    right: 30,
    textAlign: 'center',
    color: '#9ca3af',
    fontSize: 10,
    borderTop: 1,
    borderTopColor: '#e5e7eb',
    paddingTop: 10,
  },
});

const ExpenseReportPDF = ({ data }: { data: ReportData }) => {
  const t = i18n.t.bind(i18n);
  const monthlyIncome = parseFloat(data.analysis.monthlyIncome) || 0;
  const safePercentage = (amount: string, income: number) => {
    const parsedAmount = parseFloat(amount) || 0;
    return income > 0 ? Math.round((parsedAmount / income) * 100) : 0;
  };
  
  const actualNeedsPercent = safePercentage(data.analysis.actualNeeds, monthlyIncome);
  const actualWantsPercent = safePercentage(data.analysis.actualWants, monthlyIncome);
  const actualSavingsPercent = safePercentage(data.analysis.actualSavings, monthlyIncome);
  
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return t("pdf.unknown");
    }
  };
  
  const formatCurrency = (amount: string | number) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : amount;
    return isNaN(num) ? "$0.00" : `$${num.toFixed(2)}`;
  };

  const getCategoryStyle = (category: string) => {
    switch (category) {
      case "50%": return styles.needsBg;
      case "30%": return styles.wantsBg;
      case "20%": return styles.savingsBg;
      default: return styles.unclearBg;
    }
  };

  const getCategoryText = (category: string) => {
    switch (category) {
      case "50%": return t("results.needs");
      case "30%": return t("results.wants");
      case "20%": return t("results.savings");
      default: return t("results.unclear");
    }
  };

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <View style={styles.header}>
          <Text style={styles.title}>
            {t("pdf.title", { appName: t("appName") })}
          </Text>
          <Text style={styles.subtitle}>
            {t("pdf.generatedOn", { date: new Date().toLocaleDateString() })}
          </Text>
          <Text style={styles.subtitle}>
            {t("pdf.analysisId", { id: data.analysis.id })}
          </Text>
        </View>

        <View style={styles.userInfo}>
          <Text style={styles.userInfoTitle}>{t("pdf.userInfoTitle")}</Text>
          <Text style={styles.userInfoText}>
            {t("pdf.userName", { name: data.user.fullName })}
          </Text>
          <Text style={styles.userInfoText}>
            {t("pdf.userEmail", { email: data.user.email })}
          </Text>
          <Text style={styles.userInfoText}>
            {t("pdf.monthlyIncome", { income: formatCurrency(data.analysis.monthlyIncome) })}
          </Text>
          <Text style={styles.userInfoText}>
            {t("pdf.statementFile", { file: data.analysis.originalFileName || t("pdf.unknown") })}
          </Text>
          <Text style={styles.userInfoText}>
            {t("pdf.uploadDate", { date: formatDate(data.analysis.uploadDate) })}
          </Text>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t("pdf.budgetComparisonTitle")}</Text>
          <View style={styles.budgetComparison}>
            <View style={styles.budgetColumn}>
              <Text style={styles.budgetColumnTitle}>{t("pdf.currentSpending")}</Text>
              
              <View style={styles.budgetItem}>
                <View style={styles.budgetItemHeader}>
                  <Text style={[styles.budgetItemLabel, styles.needsColor]}>{t("results.needs")}</Text>
                  <Text style={[styles.budgetItemPercent, styles.needsColor]}>{actualNeedsPercent}%</Text>
                </View>
                <Text style={styles.budgetItemAmount}>{formatCurrency(data.analysis.actualNeeds)}</Text>
              </View>

              <View style={styles.budgetItem}>
                <View style={styles.budgetItemHeader}>
                  <Text style={[styles.budgetItemLabel, styles.wantsColor]}>{t("results.wants")}</Text>
                  <Text style={[styles.budgetItemPercent, styles.wantsColor]}>{actualWantsPercent}%</Text>
                </View>
                <Text style={styles.budgetItemAmount}>{formatCurrency(data.analysis.actualWants)}</Text>
              </View>

              <View style={styles.budgetItem}>
                <View style={styles.budgetItemHeader}>
                  <Text style={[styles.budgetItemLabel, styles.savingsColor]}>{t("results.savings")}</Text>
                  <Text style={[styles.budgetItemPercent, styles.savingsColor]}>{actualSavingsPercent}%</Text>
                </View>
                <Text style={styles.budgetItemAmount}>{formatCurrency(data.analysis.actualSavings)}</Text>
              </View>
            </View>

            <View style={styles.budgetColumn}>
              <Text style={styles.budgetColumnTitle}>{t("pdf.recommended")}</Text>
              
              <View style={styles.budgetItem}>
                <View style={styles.budgetItemHeader}>
                  <Text style={[styles.budgetItemLabel, styles.recommendedColor]}>{t("results.needs")}</Text>
                  <Text style={[styles.budgetItemPercent, styles.recommendedColor]}>50%</Text>
                </View>
                <Text style={styles.budgetItemAmount}>{formatCurrency(data.analysis.recommendedNeeds)}</Text>
              </View>

              <View style={styles.budgetItem}>
                <View style={styles.budgetItemHeader}>
                  <Text style={[styles.budgetItemLabel, styles.recommendedColor]}>{t("results.wants")}</Text>
                  <Text style={[styles.budgetItemPercent, styles.recommendedColor]}>30%</Text>
                </View>
                <Text style={styles.budgetItemAmount}>{formatCurrency(data.analysis.recommendedWants)}</Text>
              </View>

              <View style={styles.budgetItem}>
                <View style={styles.budgetItemHeader}>
                  <Text style={[styles.budgetItemLabel, styles.recommendedColor]}>{t("results.savings")}</Text>
                  <Text style={[styles.budgetItemPercent, styles.recommendedColor]}>20%</Text>
                </View>
                <Text style={styles.budgetItemAmount}>{formatCurrency(data.analysis.recommendedSavings)}</Text>
              </View>
            </View>
          </View>
        </View>

        {data.analysis.recommendations && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>{t("pdf.aiRecommendations")}</Text>
            <View style={styles.recommendationsBox}>
              <Text style={styles.recommendationsTitle}>{t("pdf.aiAdviceTitle")}</Text>
              <Text style={styles.recommendationsText}>{data.analysis.recommendations}</Text>
            </View>
          </View>
        )}

        <Text style={styles.footer}>
          {t("pdf.footer", {
            appName: t("appName"),
            date: new Date().toLocaleDateString(),
          })}
        </Text>
      </Page>

      {/* Second page for detailed expenses if they exist */}
      {data.analysis.expenses && data.analysis.expenses.length > 0 && (
        <Page size="A4" style={styles.page}>
          <View style={styles.header}>
            <Text style={styles.title}>{t("pdf.breakdownTitle")}</Text>
            <Text style={styles.subtitle}>{t("pdf.breakdownSubtitle")}</Text>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t("pdf.allTransactions", { count: data.analysis.expenses.length })}
            </Text>
            <View style={styles.expensesList}>
              {data.analysis.expenses.map((expense, index) => (
                <View key={index} style={styles.expenseItem}>
                  <View style={styles.expenseLeft}>
                    <Text style={styles.expenseDescription}>{expense.description}</Text>
                    {expense.subcategory && (
                      <Text style={styles.expenseSubcategory}>{expense.subcategory}</Text>
                    )}
                  </View>
                  <View style={styles.expenseRight}>
                    <Text style={styles.expenseAmount}>
                      {expense.amount < 0 ? "-" : "+"}${Math.abs(expense.amount).toFixed(2)}
                    </Text>
                    <Text style={[styles.expenseCategory, getCategoryStyle(expense.category)]}>
                      {getCategoryText(expense.category)}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
          </View>

          <Text style={styles.footer}>
            {t("pdf.footerPageTwo", { appName: t("appName") })}
          </Text>
        </Page>
      )}
    </Document>
  );
};

export const generateAndDownloadPDF = async (data: ReportData) => {
  const t = i18n.t.bind(i18n);
  const blob = await pdf(<ExpenseReportPDF data={data} />).toBlob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = t("pdf.fileName", {
    appName: t("appName"),
    name: data.user.fullName.replace(/\s+/g, "-"),
    date: new Date().toLocaleDateString().replace(/\//g, "-"),
  });
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export default ExpenseReportPDF;
