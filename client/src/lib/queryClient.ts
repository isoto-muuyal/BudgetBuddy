import { QueryClient, QueryFunction } from "@tanstack/react-query";

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    throw new Error(`${res.status}: ${text}`);
  }
}

export async function apiRequest(method: string, url: string, data?: unknown | undefined,): Promise<Response> {
  const headers: Record<string, string> = {}
  // If body is NOT FormData, assume JSON
  let fetchOptions: RequestInit = { method, headers };

  console.log(`Making API request: ${method} ${url}`, data);

 
  if (data instanceof FormData) {
    fetchOptions.body = data; // let browser set Content-Type with boundary
  } else if (data) {
    headers["Content-Type"] = "application/json";
    fetchOptions.body = JSON.stringify(data);
  }

  // If you use auth token
  const token = localStorage.getItem("token");
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(url, fetchOptions);

  if (!res.ok) {
    throw new Error((await res.json()).message || "API request failed");
  }
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {on401: UnauthorizedBehavior;}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) => async ({ queryKey }) => {
   try {
      const res = await apiRequest("GET", queryKey.join("/") as string);
      return await res.json();
    } catch (err: any) {
      if (unauthorizedBehavior === "returnNull" && err.message.startsWith("401")) {
        return null;
      }
      throw err;
    }
  
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
