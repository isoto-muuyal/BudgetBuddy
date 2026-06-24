import { useRef, useState } from "react";
import { useLocation } from "wouter";
import { useMutation, useQuery } from "@tanstack/react-query";
import { HandCoins, History, Plus, Pencil, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, getAuthToken, queryClient } from "@/lib/queryClient";
import {
  EXPENSE_ITEM_CATEGORIES,
  EXPENSE_ITEM_TYPES,
  type ActualExpenseSet,
  type ExpenseItem,
} from "@shared/schema";
import { useTranslation } from "react-i18next";

export default function SmartAnalysis() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const { t } = useTranslation();

  const [includeFiftyThirtyTwenty, setIncludeFiftyThirtyTwenty] = useState(true);
  const [includeMonthlyExpenses, setIncludeMonthlyExpenses] = useState(true);
  const [selectedSetId, setSelectedSetId] = useState<string>("");
  const [isEditing, setIsEditing] = useState(false);
  const [editedItems, setEditedItems] = useState<ExpenseItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: expenseSets = [] } = useQuery<ActualExpenseSet[]>({
    queryKey: ["/api/actual-expense-sets"],
  });

  const selectedSet = expenseSets.find((set) => set.id === selectedSetId);

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      const token = getAuthToken();
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }

      const response = await fetch("/api/actual-expense-sets/upload", {
        method: "POST",
        headers,
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || "Upload failed");
      }

      return (await response.json()) as ActualExpenseSet;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/actual-expense-sets"] });
      setSelectedSetId(data.id);
      toast({
        title: t("smartAnalysis.uploadSuccessTitle"),
        description: t("smartAnalysis.uploadSuccessDesc"),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateSetMutation = useMutation({
    mutationFn: async (items: ExpenseItem[]) => {
      const response = await apiRequest("PATCH", `/api/actual-expense-sets/${selectedSetId}`, { items });
      return (await response.json()) as ActualExpenseSet;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/actual-expense-sets"] });
      setIsEditing(false);
      toast({
        title: t("smartAnalysis.updateSuccessTitle"),
        description: t("smartAnalysis.updateSuccessDesc"),
      });
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const analysisMutation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest("POST", "/api/smart-analysis", {
        actualExpenseSetId: selectedSetId,
        includeFiftyThirtyTwenty,
        includeMonthlyExpenses,
      });
      return response.json();
    },
    onSuccess: (data) => {
      setLocation(`/smart-analysis/${data.id}`);
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      uploadMutation.mutate(file);
    }
    event.target.value = "";
  };

  const startEditing = () => {
    if (!selectedSet) return;
    setEditedItems((selectedSet.items as ExpenseItem[]).map((item) => ({ ...item })));
    setIsEditing(true);
  };

  const updateEditedItem = (index: number, field: keyof ExpenseItem, value: string) => {
    setEditedItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value } as ExpenseItem;
      return next;
    });
  };

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#5b5c67] px-4 py-8">
      <div className="mx-auto max-w-5xl">
        <Card className="border-white/10 bg-[#202133] text-white shadow-xl" data-testid="card-smart-analysis">
          <CardContent className="p-8">
            <div className="text-center mb-8">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-md bg-white/10 text-amber-400">
                <HandCoins className="h-8 w-8" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2" data-testid="text-page-title">
                {t("smartAnalysis.title")}
              </h2>
              <p className="text-slate-300" data-testid="text-page-description">
                {t("smartAnalysis.description")}
              </p>
            </div>

            <div className="space-y-6">
              <div className="rounded-lg border border-white/10 bg-[#171827] p-4 space-y-4">
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="checkbox-fifty-thirty-twenty"
                    checked={includeFiftyThirtyTwenty}
                    onCheckedChange={(checked) => setIncludeFiftyThirtyTwenty(checked === true)}
                    data-testid="checkbox-fifty-thirty-twenty"
                  />
                  <label htmlFor="checkbox-fifty-thirty-twenty" className="text-sm text-slate-200">
                    {t("smartAnalysis.includeFiftyThirtyTwenty")}
                  </label>
                </div>
                <div className="flex items-center gap-3">
                  <Checkbox
                    id="checkbox-monthly-expenses"
                    checked={includeMonthlyExpenses}
                    onCheckedChange={(checked) => setIncludeMonthlyExpenses(checked === true)}
                    data-testid="checkbox-monthly-expenses"
                  />
                  <label htmlFor="checkbox-monthly-expenses" className="text-sm text-slate-200">
                    {t("smartAnalysis.includeMonthlyExpenses")}
                  </label>
                </div>

                <div className="space-y-2">
                  <label className="text-sm text-slate-300">{t("smartAnalysis.actualExpensesLabel")}</label>
                  <div className="flex flex-wrap items-center gap-3">
                    <Select
                      value={selectedSetId}
                      onValueChange={(value) => {
                        setSelectedSetId(value);
                        setIsEditing(false);
                      }}
                    >
                      <SelectTrigger className="w-64 border-white/10 bg-[#202133] text-white" data-testid="select-actual-expense-set">
                        <SelectValue placeholder={t("smartAnalysis.selectExpenseSetPlaceholder")} />
                      </SelectTrigger>
                      <SelectContent>
                        {expenseSets.map((set) => (
                          <SelectItem key={set.id} value={set.id}>
                            {set.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    <Button
                      type="button"
                      variant="outline"
                      className="border-white/10 bg-transparent text-white hover:bg-white/10"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadMutation.isPending}
                      data-testid="button-add-new-expense-set"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      {uploadMutation.isPending ? t("smartAnalysis.uploading") : t("smartAnalysis.addNew")}
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv"
                      className="hidden"
                      onChange={handleFileChange}
                      data-testid="input-expense-csv"
                    />

                    {selectedSet && !isEditing && (
                      <Button
                        type="button"
                        variant="outline"
                        className="border-white/10 bg-transparent text-white hover:bg-white/10"
                        onClick={startEditing}
                        data-testid="button-edit-expense-set"
                      >
                        <Pencil className="h-4 w-4 mr-1" />
                        {t("smartAnalysis.edit")}
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              {isEditing && selectedSet && (
                <div className="rounded-lg border border-white/10 bg-[#171827] p-4 overflow-x-auto" data-testid="table-edit-expenses">
                  <table className="w-full text-sm text-slate-200">
                    <thead>
                      <tr className="text-left text-slate-400 border-b border-white/10">
                        <th className="py-2 pr-2">{t("smartAnalysis.colDate")}</th>
                        <th className="py-2 pr-2">{t("smartAnalysis.colDescription")}</th>
                        <th className="py-2 pr-2">{t("smartAnalysis.colBusiness")}</th>
                        <th className="py-2 pr-2">{t("smartAnalysis.colAmount")}</th>
                        <th className="py-2 pr-2">{t("smartAnalysis.colType")}</th>
                        <th className="py-2 pr-2">{t("smartAnalysis.colCategory")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {editedItems.map((item, index) => (
                        <tr key={index} className="border-b border-white/5" data-testid={`row-expense-${index}`}>
                          <td className="py-1 pr-2">
                            <Input
                              value={item.date ?? ""}
                              onChange={(e) => updateEditedItem(index, "date", e.target.value)}
                              className="h-8 w-28 border-white/10 bg-[#202133] text-white"
                              data-testid={`input-expense-date-${index}`}
                            />
                          </td>
                          <td className="py-1 pr-2">
                            <Input
                              value={item.description ?? ""}
                              onChange={(e) => updateEditedItem(index, "description", e.target.value)}
                              className="h-8 w-40 border-white/10 bg-[#202133] text-white"
                              data-testid={`input-expense-description-${index}`}
                            />
                          </td>
                          <td className="py-1 pr-2">
                            <Input
                              value={item.business ?? ""}
                              onChange={(e) => updateEditedItem(index, "business", e.target.value)}
                              className="h-8 w-32 border-white/10 bg-[#202133] text-white"
                              data-testid={`input-expense-business-${index}`}
                            />
                          </td>
                          <td className="py-1 pr-2">
                            <Input
                              value={item.amount ?? ""}
                              onChange={(e) => updateEditedItem(index, "amount", e.target.value)}
                              className="h-8 w-24 border-white/10 bg-[#202133] text-white"
                              data-testid={`input-expense-amount-${index}`}
                            />
                          </td>
                          <td className="py-1 pr-2">
                            <Select
                              value={item.type}
                              onValueChange={(value) => updateEditedItem(index, "type", value)}
                            >
                              <SelectTrigger className="h-8 w-32 border-white/10 bg-[#202133] text-white" data-testid={`select-expense-type-${index}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {EXPENSE_ITEM_TYPES.map((type) => (
                                  <SelectItem key={type} value={type}>
                                    {t(`expenseItem.type.${type}`)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                          <td className="py-1 pr-2">
                            <Select
                              value={item.category}
                              onValueChange={(value) => updateEditedItem(index, "category", value)}
                            >
                              <SelectTrigger className="h-8 w-36 border-white/10 bg-[#202133] text-white" data-testid={`select-expense-category-${index}`}>
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {EXPENSE_ITEM_CATEGORIES.map((category) => (
                                  <SelectItem key={category} value={category}>
                                    {t(`expenseItem.category.${category}`)}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <div className="mt-4 flex justify-end gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      className="border-white/10 bg-transparent text-white hover:bg-white/10"
                      onClick={() => setIsEditing(false)}
                      data-testid="button-cancel-edit"
                    >
                      {t("smartAnalysis.cancel")}
                    </Button>
                    <Button
                      type="button"
                      className="bg-amber-500 text-slate-950 hover:bg-amber-400"
                      onClick={() => updateSetMutation.mutate(editedItems)}
                      disabled={updateSetMutation.isPending}
                      data-testid="button-save-edit"
                    >
                      <Save className="h-4 w-4 mr-1" />
                      {updateSetMutation.isPending ? t("smartAnalysis.saving") : t("smartAnalysis.save")}
                    </Button>
                  </div>
                </div>
              )}

              <Button
                type="button"
                className="w-full rounded-lg bg-amber-500 py-3 font-medium text-slate-950 hover:bg-amber-400 transition-colors"
                disabled={!selectedSetId || analysisMutation.isPending}
                onClick={() => analysisMutation.mutate()}
                data-testid="button-calculate"
              >
                {analysisMutation.isPending ? t("smartAnalysis.calculating") : t("smartAnalysis.calculate")}
              </Button>

              <Button
                type="button"
                variant="outline"
                className="w-full rounded-lg border-white/10 bg-transparent py-3 font-medium text-white hover:bg-white/10"
                onClick={() => setLocation("/history")}
                data-testid="button-view-history"
              >
                <History className="w-4 h-4 mr-2" />
                {t("smartAnalysis.history")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
