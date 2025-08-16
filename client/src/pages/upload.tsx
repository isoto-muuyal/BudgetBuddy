import { useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { Upload, CloudUpload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";

export default function UploadPage() {
  const [, setLocation] = useLocation();
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const { toast } = useToast();

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/analysis/upload", {
        method: "POST",
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
        title: "Success",
        description: "File uploaded successfully! Starting analysis...",
      });
      setLocation(`/results/${data.analysisId}`);
    },
    onError: (error: Error) => {
      toast({
        title: "Error",
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
        'application/vnd.ms-excel'
      ];
      
      if (!validTypes.includes(file.type)) {
        toast({
          title: "Invalid file type",
          description: "Please upload a PDF or Excel file",
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
    <div className="max-w-md mx-auto p-4 pt-8">
      <Card className="bg-white rounded-2xl shadow-xl border border-gray-100" data-testid="card-upload">
        <CardContent className="p-8">
          <div className="text-center mb-8">
            <div className="bg-gradient-to-r from-indigo-400 to-brand-purple w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <Upload className="text-white text-2xl" />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2" data-testid="text-upload-title">
              Upload Statement
            </h2>
            <p className="text-gray-600" data-testid="text-upload-description">
              Upload your bank statement or Excel file for analysis
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
                <p className="text-lg font-medium text-gray-900">Drop your file here</p>
                <p className="text-sm text-gray-500">or click to browse</p>
              </div>
              <div className="text-xs text-gray-400">
                Supports: PDF, Excel (.xlsx, .xls)
              </div>
            </div>
            <input
              id="file-input"
              type="file"
              className="hidden"
              accept=".pdf,.xlsx,.xls"
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
                    {uploadProgress < 100 ? "Uploading..." : "Ready"}
                  </span>
                </div>
                <Progress value={uploadProgress} className="w-full" data-testid="progress-upload" />
              </div>
            )}

            <Button
              onClick={handleAnalyze}
              disabled={!selectedFile || uploadProgress < 100 || uploadMutation.isPending}
              className={`w-full py-3 rounded-lg font-medium transition-opacity ${
                selectedFile && uploadProgress >= 100
                  ? "gradient-brand text-white hover:opacity-90"
                  : "bg-gray-100 text-gray-400 cursor-not-allowed"
              }`}
              data-testid="button-analyze"
            >
              {uploadMutation.isPending ? "Analyzing..." : "Analyze Expenses"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
