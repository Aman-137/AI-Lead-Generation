import { createClient } from "@/lib/supabase/client";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:5000/api";
const REQUEST_TIMEOUT = 30000; // 30 seconds
const LONG_REQUEST_TIMEOUT = 300000; // 5 minutes (for enrichment, generation, bulk operations)

function createTimeout(): AbortSignal {
  return AbortSignal.timeout(REQUEST_TIMEOUT);
}

function createLongTimeout(): AbortSignal {
  return AbortSignal.timeout(LONG_REQUEST_TIMEOUT);
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const supabase = createClient();
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;

  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function handleErrorResponse(res: Response): Promise<never> {
  let message = "Request failed";
  try {
    const error = await res.json();
    message = error.error || message;
  } catch {
    message = res.statusText || message;
  }
  throw new Error(message);
}

function handleNetworkError(err: unknown): never {
  if (err instanceof TypeError && (err.message === "Failed to fetch" || err.message === "fetch failed")) {
    throw new Error("Unable to connect to server. Please check your internet connection or try again later.");
  }
  if (err instanceof DOMException && err.name === "TimeoutError") {
    throw new Error("Request timed out. Please try again.");
  }
  throw err;
}

export async function apiGet<T>(endpoint: string): Promise<T> {
  const headers = await getAuthHeaders();
  let res: Response;
  try {
    res = await fetch(`${API_URL}${endpoint}`, {
      method: "GET",
      headers,
      signal: createTimeout(),
    });
  } catch (err) { handleNetworkError(err); }

  if (!res.ok) await handleErrorResponse(res);
  return res.json();
}

export async function apiPost<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
  const headers = await getAuthHeaders();
  let res: Response;
  try {
    res = await fetch(`${API_URL}${endpoint}`, {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: createTimeout(),
    });
  } catch (err) { handleNetworkError(err); }

  if (!res.ok) await handleErrorResponse(res);
  return res.json();
}

// Same as apiPost but with 3-minute timeout for heavy operations (enrichment, bulk)
export async function apiPostLong<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
  const headers = await getAuthHeaders();
  let res: Response;
  try {
    res = await fetch(`${API_URL}${endpoint}`, {
      method: "POST",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: createLongTimeout(),
    });
  } catch (err) { handleNetworkError(err); }

  if (!res.ok) await handleErrorResponse(res);
  return res.json();
}

export async function apiPut<T>(endpoint: string, body: Record<string, unknown>): Promise<T> {
  const headers = await getAuthHeaders();
  let res: Response;
  try {
    res = await fetch(`${API_URL}${endpoint}`, {
      method: "PUT",
      headers: {
        ...headers,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: createTimeout(),
    });
  } catch (err) { handleNetworkError(err); }

  if (!res.ok) await handleErrorResponse(res);
  return res.json();
}

export async function apiDelete<T>(endpoint: string): Promise<T> {
  const headers = await getAuthHeaders();
  let res: Response;
  try {
    res = await fetch(`${API_URL}${endpoint}`, {
      method: "DELETE",
      headers,
      signal: createTimeout(),
    });
  } catch (err) { handleNetworkError(err); }

  if (!res.ok) await handleErrorResponse(res);
  return res.json();
}

export async function apiPostFormData<T>(endpoint: string, formData: FormData): Promise<T> {
  const headers = await getAuthHeaders();
  let res: Response;
  try {
    res = await fetch(`${API_URL}${endpoint}`, {
      method: "POST",
      headers,
      body: formData,
      signal: createTimeout(),
    });
  } catch (err) { handleNetworkError(err); }

  if (!res.ok) await handleErrorResponse(res);
  return res.json();
}
