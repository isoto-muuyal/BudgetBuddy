import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Mail } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
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

type RankedItem = {
  name: string;
  count: number;
};

type AdminUserRow = {
  id: string;
  email: string;
  frozen: boolean;
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
  const adminToken = getAdminToken();
  const queryClient = useQueryClient();
  const { toast } = useToast();

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

  const visitsQuery = useQuery<VisitRow[]>({
    queryKey: ["/api/admin/visits", adminToken],
    enabled: isAuthenticated && Boolean(adminToken),
    queryFn: async () => {
      try {
        return await adminFetch("/api/admin/visits");
      } catch (error) {
        handleAuthError(error);
        throw error;
      }
    },
    refetchInterval: 10000,
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

  const rows = useMemo(() => visitsQuery.data ?? [], [visitsQuery.data]);
  const users = useMemo(() => usersQuery.data ?? [], [usersQuery.data]);
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

          <Card className="bg-white rounded-2xl shadow-xl border border-gray-100">
            <CardHeader>
              <CardTitle>Visit Logs</CardTitle>
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
                        <TableCell colSpan={3} className="text-center text-gray-500">
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
