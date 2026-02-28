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
                  </TableRow>
                ))}
                {rows.length === 0 && !visitsQuery.isLoading && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-gray-500">
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
