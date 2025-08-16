import { useQuery } from "@tanstack/react-query";

export default function LoadingOverlay() {
  const { data: isLoading } = useQuery({
    queryKey: ["loading"],
    queryFn: () => false,
    enabled: false,
  });

  if (!isLoading) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" data-testid="overlay-loading">
      <div className="bg-white rounded-2xl p-8 max-w-sm mx-4 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-blue mx-auto mb-4"></div>
        <h3 className="text-lg font-semibold text-gray-900 mb-2" data-testid="text-loading-title">
          Analyzing Your Expenses
        </h3>
        <p className="text-gray-600 text-sm" data-testid="text-loading-description">
          AI is reviewing your bank statement...
        </p>
      </div>
    </div>
  );
}
