import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Mail, ShieldCheck, X } from "lucide-react";
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { getAdminToken, removeAdminToken, setAdminToken } from "@/lib/queryClient";

type VisitRow = {
  timestamp: string;
  page: string;
  button: string;
  section: string;
  location: string;
  ipAddress: string;
  userIdentifier: string;
};

type VisitsResponse = {
  rows: VisitRow[];
  total: number;
  page: number;
  pageSize: number;
};

type RankedItem = {
  name: string;
  count: number;
};

type VisitStats = {
  topPages: RankedItem[];
  topButtons: RankedItem[];
  uniqueUsers: number;
};

const VISIT_PAGE_SIZE_OPTIONS = [20, 50, 100] as const;

type DailyVisitPoint = {
  date: string;
  totalVisits: number;
  uniqueVisitors: number;
};

type WeeklyVisitTotal = {
  weekStart: string;
  totalVisits: number;
};

type RepeatVisitorAlert = {
  date: string;
  identifier: string;
  ipAddress: string;
  visits: number;
};

type TrustedVisitor = {
  identifier: string;
  note: string | null;
  createdAt: string;
};

const CHART_COLORS = {
  totalVisits: "#2563eb",
  uniqueVisitors: "#059669",
};

function formatChartDate(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function truncateIdentifier(identifier: string): string {
  if (identifier.includes(".") || identifier.includes(":")) {
    return identifier; // looks like an IP, show as-is
  }
  return identifier.length > 12 ? `${identifier.slice(0, 8)}…` : identifier;
}

type AdminUserRow = {
  id: string;
  email: string;
  frozen: boolean;
  createdAt: string | null;
  lastLoginAt: string | null;
  passwordResetRequestedAt: string | null;
};

type UserStats = {
  totalUsers: number;
  verifiedUsers: number;
  totalLogins: number;
  loginsLast7Days: number;
  loginsLast30Days: number;
};

async function adminFetch(path: string, options: RequestInit = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      Authorization: `Bearer ${getAdminToken()}`,
      ...options.headers,
    },
    credentials: "include",
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const error = new Error(body.message || "Request failed") as Error & { status?: number };
    error.status = response.status;
    throw error;
  }

  return response.json();
}

export default function AdminPage() {
  const [credentials, setCredentials] = useState({ username: "", password: "" });
  const [isAuthenticated, setIsAuthenticated] = useState(Boolean(getAdminToken()));
  const [generatedTemporaryPassword, setGeneratedTemporaryPassword] = useState<{
    email: string;
    password: string;
  } | null>(null);
  const adminToken = getAdminToken();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const formatTimestamp = (value: string | null) => value ? new Date(value).toLocaleString() : "-";

  const handleAuthError = (error: any) => {
    if (error?.status === 401 || error?.status === 403) {
      removeAdminToken();
      setIsAuthenticated(false);
    }
  };

  const loginMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(credentials),
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error((await response.json()).message || "Admin login failed");
      }

      return response.json();
    },
    onSuccess: (data) => {
      setAdminToken(data.token);
      setIsAuthenticated(true);
    },
  });

  const [visitsPage, setVisitsPage] = useState(1);
  const [visitsPageSize, setVisitsPageSize] = useState<number>(20);

  const visitsQuery = useQuery<VisitsResponse>({
    queryKey: ["/api/admin/visits", adminToken, visitsPage, visitsPageSize],
    enabled: isAuthenticated && Boolean(adminToken),
    queryFn: async () => {
      try {
        return await adminFetch(`/api/admin/visits?page=${visitsPage}&pageSize=${visitsPageSize}`);
      } catch (error) {
        handleAuthError(error);
        throw error;
      }
    },
    refetchInterval: 10000,
  });

  const visitStatsQuery = useQuery<VisitStats>({
    queryKey: ["/api/admin/visits/stats", adminToken],
    enabled: isAuthenticated && Boolean(adminToken),
    queryFn: async () => {
      try {
        return await adminFetch("/api/admin/visits/stats");
      } catch (error) {
        handleAuthError(error);
        throw error;
      }
    },
    refetchInterval: 10000,
  });

  const dailyHistoryQuery = useQuery<DailyVisitPoint[]>({
    queryKey: ["/api/admin/visits/daily", adminToken],
    enabled: isAuthenticated && Boolean(adminToken),
    queryFn: async () => {
      try {
        return await adminFetch("/api/admin/visits/daily?days=30");
      } catch (error) {
        handleAuthError(error);
        throw error;
      }
    },
  });

  const weeklyTotalsQuery = useQuery<WeeklyVisitTotal[]>({
    queryKey: ["/api/admin/visits/weekly", adminToken],
    enabled: isAuthenticated && Boolean(adminToken),
    queryFn: async () => {
      try {
        return await adminFetch("/api/admin/visits/weekly?weeks=8");
      } catch (error) {
        handleAuthError(error);
        throw error;
      }
    },
  });

  const repeatVisitorsQuery = useQuery<RepeatVisitorAlert[]>({
    queryKey: ["/api/admin/visits/repeat", adminToken],
    enabled: isAuthenticated && Boolean(adminToken),
    queryFn: async () => {
      try {
        return await adminFetch("/api/admin/visits/repeat?days=7");
      } catch (error) {
        handleAuthError(error);
        throw error;
      }
    },
    refetchInterval: 10000,
  });

  const trustedVisitorsQuery = useQuery<TrustedVisitor[]>({
    queryKey: ["/api/admin/visits/trusted", adminToken],
    enabled: isAuthenticated && Boolean(adminToken),
    queryFn: async () => {
      try {
        return await adminFetch("/api/admin/visits/trusted");
      } catch (error) {
        handleAuthError(error);
        throw error;
      }
    },
  });

  const addTrustedVisitorMutation = useMutation({
    mutationFn: async (identifier: string) =>
      adminFetch("/api/admin/visits/trusted", {
        method: "POST",
        body: JSON.stringify({ identifier, note: "Marked from repeat-visitor alerts" }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/visits/trusted", adminToken] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/visits/repeat", adminToken] });
      toast({ title: "Marked as trusted", description: "This visitor will no longer trigger repeat-visit alerts." });
    },
    onError: (error: any) => {
      handleAuthError(error);
      toast({
        title: "Could not mark as trusted",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  const removeTrustedVisitorMutation = useMutation({
    mutationFn: async (identifier: string) =>
      adminFetch(`/api/admin/visits/trusted/${encodeURIComponent(identifier)}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/visits/trusted", adminToken] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/visits/repeat", adminToken] });
    },
    onError: handleAuthError,
  });

  const exportVisitsMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch("/api/admin/visits/export", {
        headers: { Authorization: `Bearer ${getAdminToken()}` },
        credentials: "include",
      });
      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        const error = new Error(body.message || "Export failed") as Error & { status?: number };
        error.status = response.status;
        throw error;
      }
      return response.blob();
    },
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `visit-logs-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    },
    onError: (error: any) => {
      handleAuthError(error);
      toast({
        title: "Export failed",
        description: error?.message || "Could not export visit logs.",
        variant: "destructive",
      });
    },
  });

  const usersQuery = useQuery<AdminUserRow[]>({
    queryKey: ["/api/admin/users", adminToken],
    enabled: isAuthenticated && Boolean(adminToken),
    queryFn: async () => {
      try {
        return await adminFetch("/api/admin/users");
      } catch (error) {
        handleAuthError(error);
        throw error;
      }
    },
  });

  const statsQuery = useQuery<UserStats>({
    queryKey: ["/api/admin/stats", adminToken],
    enabled: isAuthenticated && Boolean(adminToken),
    queryFn: async () => {
      try {
        return await adminFetch("/api/admin/stats");
      } catch (error) {
        handleAuthError(error);
        throw error;
      }
    },
  });

  const freezeMutation = useMutation({
    mutationFn: async ({ id, frozen }: { id: string; frozen: boolean }) =>
      adminFetch(`/api/admin/users/${id}/freeze`, {
        method: "POST",
        body: JSON.stringify({ frozen }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users", adminToken] });
    },
    onError: handleAuthError,
  });

  const resetPasswordMutation = useMutation({
    mutationFn: async (id: string) =>
      adminFetch(`/api/admin/users/${id}/password-reset`, {
        method: "POST",
      }),
    onSuccess: (data: { message?: string }) => {
      toast({
        title: "Reset link sent",
        description: data.message || "The password reset email was sent.",
      });
    },
    onError: (error: any) => {
      handleAuthError(error);
      toast({
        title: "Could not send reset link",
        description: error?.message || "The password reset email could not be sent.",
        variant: "destructive",
      });
    },
  });

  const temporaryPasswordMutation = useMutation({
    mutationFn: async (user: AdminUserRow) => {
      const data = await adminFetch(`/api/admin/users/${user.id}/temporary-password`, {
        method: "POST",
      });
      return { email: user.email, temporaryPassword: data.temporaryPassword as string };
    },
    onSuccess: (data) => {
      setGeneratedTemporaryPassword({ email: data.email, password: data.temporaryPassword });
      toast({
        title: "Temporary password generated",
        description: "Copy it now. It will not be shown again.",
      });
    },
    onError: (error: any) => {
      handleAuthError(error);
      toast({
        title: "Could not generate temporary password",
        description: error?.message || "The temporary password could not be generated.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => adminFetch(`/api/admin/users/${id}`, { method: "DELETE" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users", adminToken] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/stats", adminToken] });
      toast({
        title: "User deleted",
        description: "The user and related data were deleted.",
      });
    },
    onError: (error: any) => {
      handleAuthError(error);
      toast({
        title: "Could not delete user",
        description: error?.message || "The user could not be deleted.",
        variant: "destructive",
      });
    },
  });

  const rows = useMemo(() => visitsQuery.data?.rows ?? [], [visitsQuery.data]);
  const visitsTotal = visitsQuery.data?.total ?? 0;
  const visitsPageCount = Math.max(1, Math.ceil(visitsTotal / visitsPageSize));
  const users = useMemo(() => usersQuery.data ?? [], [usersQuery.data]);
  const stats: VisitStats = visitStatsQuery.data ?? { topPages: [], topButtons: [], uniqueUsers: 0 };
  const dailyHistory = useMemo(
    () => (dailyHistoryQuery.data ?? []).map((point) => ({ ...point, label: formatChartDate(point.date) })),
    [dailyHistoryQuery.data]
  );
  const weeklyTotals = weeklyTotalsQuery.data ?? [];
  const thisWeekTotal = weeklyTotals.at(-1)?.totalVisits ?? 0;
  const lastWeekTotal = weeklyTotals.at(-2)?.totalVisits ?? 0;
  const uniqueVisitorsToday = dailyHistory.at(-1)?.uniqueVisitors ?? 0;
  const repeatVisitors = repeatVisitorsQuery.data ?? [];
  const trustedVisitors = trustedVisitorsQuery.data ?? [];

  useEffect(() => {
    if (visitsPage > visitsPageCount) {
      setVisitsPage(visitsPageCount);
    }
  }, [visitsPage, visitsPageCount]);

  if (!isAuthenticated) {
    return (
      <div className="max-w-md mx-auto p-4 pt-8">
        <Card className="bg-white rounded-2xl shadow-xl border border-gray-100">
          <CardHeader>
            <CardTitle>Admin Access</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              placeholder="Username"
              value={credentials.username}
              onChange={(event) => setCredentials((current) => ({ ...current, username: event.target.value }))}
            />
            <Input
              placeholder="Password"
              type="password"
              value={credentials.password}
              onChange={(event) => setCredentials((current) => ({ ...current, password: event.target.value }))}
            />
            <Button onClick={() => loginMutation.mutate()} disabled={loginMutation.isPending} className="w-full">
              {loginMutation.isPending ? "Signing in..." : "Sign in"}
            </Button>
            {loginMutation.isError && (
              <div className="text-sm text-red-600">
                {(loginMutation.error as Error).message}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 pt-8">
      <Dialog open={Boolean(generatedTemporaryPassword)} onOpenChange={(open) => !open && setGeneratedTemporaryPassword(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Temporary Password</DialogTitle>
            <DialogDescription>
              Share this with {generatedTemporaryPassword?.email}. It can be used to sign in once and then the user must set a new password.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="rounded-md border bg-muted px-3 py-2 font-mono text-sm break-all">
              {generatedTemporaryPassword?.password}
            </div>
            <Button
              className="w-full"
              onClick={() => {
                if (generatedTemporaryPassword?.password) {
                  navigator.clipboard?.writeText(generatedTemporaryPassword.password);
                }
              }}
            >
              Copy Password
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <div className="flex items-center justify-end mb-4">
        <Button
          variant="outline"
          onClick={() => {
            removeAdminToken();
            setIsAuthenticated(false);
          }}
        >
          Logout
        </Button>
      </div>

      <Tabs defaultValue="visits">
        <TabsList className="mb-6">
          <TabsTrigger value="visits">Visits</TabsTrigger>
          <TabsTrigger value="users">Users</TabsTrigger>
          <TabsTrigger value="statistics">Statistics</TabsTrigger>
        </TabsList>

        <TabsContent value="visits">
          <div className="grid gap-6 mb-6 lg:grid-cols-3">
            <Card className="bg-white rounded-2xl shadow-xl border border-gray-100">
              <CardHeader>
                <CardTitle>Unique Users</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-gray-900">{stats.uniqueUsers}</div>
                <div className="text-sm text-gray-500">Distinct logged-in users captured in visit events</div>
              </CardContent>
            </Card>
            <Card className="bg-white rounded-2xl shadow-xl border border-gray-100 lg:col-span-2">
              <CardHeader>
                <CardTitle>Statistics</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-6 md:grid-cols-2">
                <div>
                  <div className="font-semibold text-gray-900 mb-3">Top 10 Most Visited Pages</div>
                  <div className="space-y-2">
                    {stats.topPages.length ? stats.topPages.map((item) => (
                      <div key={item.name} className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-sm">
                        <span className="truncate pr-4">{item.name}</span>
                        <span className="font-semibold">{item.count}</span>
                      </div>
                    )) : (
                      <div className="text-sm text-gray-500">No page visits yet.</div>
                    )}
                  </div>
                </div>
                <div>
                  <div className="font-semibold text-gray-900 mb-3">Top 10 Most Clicked Buttons</div>
                  <div className="space-y-2">
                    {stats.topButtons.length ? stats.topButtons.map((item) => (
                      <div key={item.name} className="flex items-center justify-between rounded-lg border border-gray-200 px-3 py-2 text-sm">
                        <span className="truncate pr-4">{item.name}</span>
                        <span className="font-semibold">{item.count}</span>
                      </div>
                    )) : (
                      <div className="text-sm text-gray-500">No button clicks yet.</div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 mb-6 md:grid-cols-3">
            <Card className="bg-white rounded-2xl shadow-xl border border-gray-100">
              <CardHeader>
                <CardTitle className="text-sm text-gray-500">Unique Visitors Today</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-gray-900">{uniqueVisitorsToday}</div>
                <div className="text-sm text-gray-500">Deduped by visitor id, falls back to IP</div>
              </CardContent>
            </Card>
            <Card className="bg-white rounded-2xl shadow-xl border border-gray-100">
              <CardHeader>
                <CardTitle className="text-sm text-gray-500">This Week</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-gray-900">{thisWeekTotal}</div>
                <div className="text-sm text-gray-500">Visits since Monday</div>
              </CardContent>
            </Card>
            <Card className="bg-white rounded-2xl shadow-xl border border-gray-100">
              <CardHeader>
                <CardTitle className="text-sm text-gray-500">Last Week</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-gray-900">{lastWeekTotal}</div>
                <div className="text-sm text-gray-500">Total visits, previous week</div>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-white rounded-2xl shadow-xl border border-gray-100 mb-6">
            <CardHeader>
              <CardTitle>Visit History (Last 30 Days)</CardTitle>
            </CardHeader>
            <CardContent>
              {dailyHistoryQuery.isLoading ? (
                <div className="text-sm text-gray-500">Loading history...</div>
              ) : (
                <div className="h-72 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailyHistory} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" vertical={false} />
                      <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#6b7280" }} tickLine={false} axisLine={{ stroke: "#e5e7eb" }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 12, fill: "#6b7280" }} tickLine={false} axisLine={false} width={32} />
                      <RechartsTooltip
                        contentStyle={{ borderRadius: 8, borderColor: "#e5e7eb", fontSize: 13 }}
                        labelStyle={{ color: "#111827", fontWeight: 600 }}
                      />
                      <Legend wrapperStyle={{ fontSize: 13 }} />
                      <Line
                        type="monotone"
                        dataKey="totalVisits"
                        name="Total Visits"
                        stroke={CHART_COLORS.totalVisits}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="uniqueVisitors"
                        name="Unique Visitors"
                        stroke={CHART_COLORS.uniqueVisitors}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-6 mb-6 lg:grid-cols-2">
            <Card className="bg-white rounded-2xl shadow-xl border border-gray-100">
              <CardHeader>
                <CardTitle>Repeat Visitors (Last 7 Days)</CardTitle>
                <div className="text-sm text-gray-500">
                  Same visitor (or IP) hitting the site more than once in a day. Mark yourself as trusted to stop seeing your own testing traffic here.
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {repeatVisitors.length === 0 && !repeatVisitorsQuery.isLoading && (
                    <div className="text-sm text-gray-500">No repeat visitors in the last 7 days.</div>
                  )}
                  {repeatVisitors.map((alert) => (
                    <div
                      key={`${alert.date}-${alert.identifier}`}
                      className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-xs text-gray-500">{alert.date}</span>
                          <span className="font-semibold truncate">{alert.ipAddress || truncateIdentifier(alert.identifier)}</span>
                          <Badge variant="secondary">{alert.visits} visits</Badge>
                        </div>
                        {alert.ipAddress !== alert.identifier && (
                          <div className="text-xs text-gray-400 truncate">visitor id: {truncateIdentifier(alert.identifier)}</div>
                        )}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={addTrustedVisitorMutation.isPending}
                        onClick={() => addTrustedVisitorMutation.mutate(alert.identifier)}
                      >
                        <ShieldCheck className="mr-2 h-4 w-4" />
                        Mark trusted
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-white rounded-2xl shadow-xl border border-gray-100">
              <CardHeader>
                <CardTitle>Trusted Visitors</CardTitle>
                <div className="text-sm text-gray-500">Excluded from the repeat-visitor alert above.</div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {trustedVisitors.length === 0 && !trustedVisitorsQuery.isLoading && (
                    <div className="text-sm text-gray-500">No trusted visitors yet.</div>
                  )}
                  {trustedVisitors.map((trusted) => (
                    <div
                      key={trusted.identifier}
                      className="flex items-center justify-between gap-3 rounded-lg border border-gray-200 px-3 py-2 text-sm"
                    >
                      <span className="font-mono truncate">{trusted.identifier}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        disabled={removeTrustedVisitorMutation.isPending}
                        onClick={() => removeTrustedVisitorMutation.mutate(trusted.identifier)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-white rounded-2xl shadow-xl border border-gray-100">
            <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Visit Logs</CardTitle>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">Rows per page</span>
                  <Select
                    value={String(visitsPageSize)}
                    onValueChange={(value) => {
                      setVisitsPageSize(Number(value));
                      setVisitsPage(1);
                    }}
                  >
                    <SelectTrigger className="w-20">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VISIT_PAGE_SIZE_OPTIONS.map((size) => (
                        <SelectItem key={size} value={String(size)}>
                          {size}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={exportVisitsMutation.isPending}
                  onClick={() => exportVisitsMutation.mutate()}
                >
                  <Download className="mr-2 h-4 w-4" />
                  {exportVisitsMutation.isPending ? "Exporting..." : "Export CSV"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>Page</TableHead>
                      <TableHead>Button</TableHead>
                      <TableHead>Section</TableHead>
                      <TableHead>Location</TableHead>
                      <TableHead>IP Address</TableHead>
                      <TableHead>User</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((row, index) => (
                      <TableRow key={`${row.timestamp}-${index}`}>
                        <TableCell>{row.timestamp ? new Date(row.timestamp).toLocaleString() : ""}</TableCell>
                        <TableCell>{row.page || "-"}</TableCell>
                        <TableCell>{row.button || "-"}</TableCell>
                        <TableCell>{row.section || "-"}</TableCell>
                        <TableCell>{row.location || "-"}</TableCell>
                        <TableCell>{row.ipAddress || "-"}</TableCell>
                        <TableCell>{row.userIdentifier || "-"}</TableCell>
                      </TableRow>
                    ))}
                    {rows.length === 0 && !visitsQuery.isLoading && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-gray-500">
                          No visit data yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-gray-500">
                  {visitsTotal === 0
                    ? "No visits"
                    : `Showing ${(visitsPage - 1) * visitsPageSize + 1}-${Math.min(visitsPage * visitsPageSize, visitsTotal)} of ${visitsTotal}`}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={visitsPage <= 1}
                    onClick={() => setVisitsPage((page) => Math.max(1, page - 1))}
                  >
                    Previous
                  </Button>
                  <span className="text-sm text-gray-500">
                    Page {visitsPage} of {visitsPageCount}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={visitsPage >= visitsPageCount}
                    onClick={() => setVisitsPage((page) => Math.min(visitsPageCount, page + 1))}
                  >
                    Next
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="users">
          <Card className="bg-white rounded-2xl shadow-xl border border-gray-100">
            <CardHeader>
              <CardTitle>Users</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead>Last Login</TableHead>
                      <TableHead>Last Reset Request</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell>{user.email}</TableCell>
                        <TableCell>
                          {user.frozen ? (
                            <Badge variant="destructive">Frozen</Badge>
                          ) : (
                            <Badge variant="secondary">Active</Badge>
                          )}
                        </TableCell>
                        <TableCell>{formatTimestamp(user.createdAt)}</TableCell>
                        <TableCell>{formatTimestamp(user.lastLoginAt)}</TableCell>
                        <TableCell>{formatTimestamp(user.passwordResetRequestedAt)}</TableCell>
                        <TableCell className="text-right space-x-2">
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={freezeMutation.isPending}
                            onClick={() => freezeMutation.mutate({ id: user.id, frozen: !user.frozen })}
                          >
                            {user.frozen ? "Unfreeze" : "Freeze"}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={resetPasswordMutation.isPending}
                            onClick={() => resetPasswordMutation.mutate(user.id)}
                          >
                            <Mail className="mr-2 h-4 w-4" />
                            Reset Link
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={temporaryPasswordMutation.isPending}
                            onClick={() => temporaryPasswordMutation.mutate(user)}
                          >
                            Temp Password
                          </Button>
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="destructive" size="sm" disabled={deleteMutation.isPending}>
                                Delete
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Delete this user?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  This permanently deletes {user.email} and all of their budget, debt, and income data. This cannot be undone.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Cancel</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteMutation.mutate(user.id)}>
                                  Delete
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </TableCell>
                      </TableRow>
                    ))}
                    {users.length === 0 && !usersQuery.isLoading && (
                      <TableRow>
                        <TableCell colSpan={6} className="text-center text-gray-500">
                          No users yet.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="statistics">
          <div className="grid gap-6 md:grid-cols-3 lg:grid-cols-5">
            <Card className="bg-white rounded-2xl shadow-xl border border-gray-100">
              <CardHeader>
                <CardTitle className="text-sm text-gray-500">Registered Users</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-gray-900">{statsQuery.data?.totalUsers ?? "-"}</div>
              </CardContent>
            </Card>
            <Card className="bg-white rounded-2xl shadow-xl border border-gray-100">
              <CardHeader>
                <CardTitle className="text-sm text-gray-500">Activated Accounts</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-gray-900">{statsQuery.data?.verifiedUsers ?? "-"}</div>
              </CardContent>
            </Card>
            <Card className="bg-white rounded-2xl shadow-xl border border-gray-100">
              <CardHeader>
                <CardTitle className="text-sm text-gray-500">Logins (7 days)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-gray-900">{statsQuery.data?.loginsLast7Days ?? "-"}</div>
              </CardContent>
            </Card>
            <Card className="bg-white rounded-2xl shadow-xl border border-gray-100">
              <CardHeader>
                <CardTitle className="text-sm text-gray-500">Logins (30 days)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-gray-900">{statsQuery.data?.loginsLast30Days ?? "-"}</div>
              </CardContent>
            </Card>
            <Card className="bg-white rounded-2xl shadow-xl border border-gray-100">
              <CardHeader>
                <CardTitle className="text-sm text-gray-500">Total Logins</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-4xl font-bold text-gray-900">{statsQuery.data?.totalLogins ?? "-"}</div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
