import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { HandCoins, CloudUpload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { getAuthToken } from "@/lib/queryClient";
import { useTranslation } from "react-i18next";

export default function UploadPage() {
  const [, setLocation] = useLocation();
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { toast } = useToast();
  const { t } = useTranslation();

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      const token = getAuthToken();
      const headers: Record<string, string> = {};
      
      // Add Authorization header if token exists
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch("/api/analysis/upload", {
        method: "POST",
        headers,
        body: formData,
        credentials: "include",
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(error || "Upload failed");
      }

      return response.json();
    },
    onSuccess: (data) => {
      toast({
        title: t("upload.successTitle"),
        description: t("upload.successDesc"),
      });
      setLocation(`/results/${data.analysisId}`);
    },
    onError: (error: Error) => {
      toast({
        title: t("common.error"),
        description: error.message,
        variant: "destructive",
      });
      setSelectedFile(null);
      setUploadProgress(0);
    },
  });

  const handleFileSelect = (file: File) => {
    setSelectedFile(file);
    
    // Simulate upload progress
    let progress = 0;
    const interval = setInterval(() => {
      progress += 10;
      setUploadProgress(progress);
      
      if (progress >= 100) {
        clearInterval(interval);
      }
    }, 150);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const validTypes = [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'text/csv'
      ];
      
      if (!validTypes.includes(file.type)) {
        toast({
          title: t("upload.invalidTitle"),
          description: t("upload.invalidDesc"),
          variant: "destructive",
        });
        return;
      }
      
      handleFileSelect(file);
    }
  };

  const handleAnalyze = () => {
    if (selectedFile) {
      uploadMutation.mutate(selectedFile);
    }
  };

  return (
    <main className="min-h-[calc(100vh-4rem)] bg-[#5b5c67] px-4 py-8">
    <div className="mx-auto max-w-4xl">
      <Card className="border-white/10 bg-[#202133] text-white shadow-xl" data-testid="card-upload">
        <CardContent className="p-8">
          <div className="text-center mb-8">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-md bg-white/10 text-amber-400">
              <HandCoins className="h-8 w-8" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2" data-testid="text-upload-title">
              {t("upload.title")}
            </h2>
            <p className="text-slate-300" data-testid="text-upload-description">
              {t("upload.description")}
            </p>
          </div>

          <div
            className="cursor-pointer rounded-lg border-2 border-dashed border-white/10 bg-[#171827] p-8 text-center transition-colors hover:border-amber-400/60"
            onClick={() => document.getElementById('file-input')?.click()}
            data-testid="dropzone-upload"
          >
            <div className="space-y-4">
              <CloudUpload className="mx-auto h-10 w-10 text-slate-500" />
              <div>
                <p className="text-lg font-medium text-white">{t("upload.dropTitle")}</p>
                <p className="text-sm text-slate-400">{t("upload.dropSubtitle")}</p>
              </div>
              <div className="text-xs text-slate-500">
                {t("upload.supports")}
              </div>
            </div>
            <input
              id="file-input"
              type="file"
              className="hidden"
              accept=".pdf,.xlsx,.xls,.csv"
              onChange={handleFileChange}
              data-testid="input-file"
            />
          </div>

          <div className="mt-6 space-y-4">
            {selectedFile && (
              <div className="rounded-lg border border-white/10 bg-[#171827] p-4" data-testid="card-upload-progress">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-slate-200" data-testid="text-filename">
                    {selectedFile.name}
                  </span>
                  <span className="text-sm text-slate-400" data-testid="text-upload-status">
                    {uploadProgress < 100 ? t("upload.uploadStatus") : t("upload.readyStatus")}
                  </span>
                </div>
                <Progress value={uploadProgress} className="w-full" data-testid="progress-upload" />
              </div>
            )}

            <Button
              onClick={handleAnalyze}
              disabled={!selectedFile || uploadProgress < 100 || uploadMutation.isPending}
              className={`w-full py-3 rounded-lg font-medium transition-all ${
                selectedFile && uploadProgress >= 100 && !uploadMutation.isPending
                  ? "bg-amber-500 text-slate-950 hover:bg-amber-400"
                  : "bg-white/10 text-slate-500 cursor-not-allowed"
              }`}
              data-testid="button-analyze"
            >
              {uploadMutation.isPending ? t("upload.analyzing") : t("upload.analyze")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
    </main>
  );
}
