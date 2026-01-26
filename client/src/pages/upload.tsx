import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Upload, CloudUpload } from "lucide-react";
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
    <div className="w-[70vw] mx-auto p-4 pt-8">
      <Card className="bg-white rounded-2xl shadow-xl border border-gray-100" data-testid="card-upload">
        <CardContent className="p-8">
          <div className="text-center mb-8">
            <div className="bg-gradient-to-r from-indigo-400 to-brand-purple w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Upload className="text-white text-2xl" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2" data-testid="text-upload-title">
              {t("upload.title")}
            </h2>
            <p className="text-gray-600" data-testid="text-upload-description">
              {t("upload.description")}
            </p>
          </div>

          <div
            className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-brand-blue transition-colors cursor-pointer"
            onClick={() => document.getElementById('file-input')?.click()}
            data-testid="dropzone-upload"
          >
            <div className="space-y-4">
              <CloudUpload className="text-4xl text-gray-400 mx-auto" />
              <div>
                <p className="text-lg font-medium text-gray-900">{t("upload.dropTitle")}</p>
                <p className="text-sm text-gray-500">{t("upload.dropSubtitle")}</p>
              </div>
              <div className="text-xs text-gray-400">
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
              <div className="bg-gray-50 p-4 rounded-lg" data-testid="card-upload-progress">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700" data-testid="text-filename">
                    {selectedFile.name}
                  </span>
                  <span className="text-sm text-gray-500" data-testid="text-upload-status">
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
                  ? "bg-gradient-to-r from-green-400 to-blue-500 text-white hover:opacity-90 hover:shadow-lg"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
              }`}
              data-testid="button-analyze"
            >
              {uploadMutation.isPending ? t("upload.analyzing") : t("upload.analyze")}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
