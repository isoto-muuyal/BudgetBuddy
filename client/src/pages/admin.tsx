import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

type RankedItem = {
  name: string;
  count: number;
};

export default function AdminPage() {
  const [credentials, setCredentials] = useState({ username: "", password: "" });
  const [isAuthenticated, setIsAuthenticated] = useState(Boolean(getAdminToken()));
  const adminToken = getAdminToken();

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

  const visitsQuery = useQuery<VisitRow[]>({
    queryKey: ["/api/admin/visits", adminToken],
    enabled: isAuthenticated && Boolean(adminToken),
    queryFn: async () => {
      const response = await fetch("/api/admin/visits", {
        headers: {
          Authorization: `Bearer ${getAdminToken()}`,
        },
        credentials: "include",
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          removeAdminToken();
          setIsAuthenticated(false);
        }
        throw new Error((await response.json()).message || "Failed to load visits");
      }

      return response.json();
    },
    refetchInterval: 10000,
  });

  const rows = useMemo(() => visitsQuery.data ?? [], [visitsQuery.data]);
  const stats = useMemo(() => {
    const rankTop = (values: string[]): RankedItem[] =>
      Object.entries(values.reduce<Record<string, number>>((acc, value) => {
        if (!value) return acc;
        acc[value] = (acc[value] || 0) + 1;
        return acc;
      }, {}))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10)
        .map(([name, count]) => ({ name, count }));

    const topPages = rankTop(rows.map((row) => row.page));
    const topButtons = rankTop(rows.map((row) => row.button));
    const uniqueUsers = new Set(rows.map((row) => row.userIdentifier).filter(Boolean)).size;

    return { topPages, topButtons, uniqueUsers };
  }, [rows]);

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

      <Card className="bg-white rounded-2xl shadow-xl border border-gray-100">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Visit Logs</CardTitle>
          <Button
            variant="outline"
            onClick={() => {
              removeAdminToken();
              setIsAuthenticated(false);
            }}
          >
            Logout
          </Button>
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
        </CardContent>
      </Card>
    </div>
  );
}
