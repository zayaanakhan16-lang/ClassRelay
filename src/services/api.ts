/**
 * The API client.
 *
 * The browser only ever sends a task name and its data. Prompts and credentials stay on
 * the server. Every call returns a typed result or throws a `RequestError` with a message
 * that is safe to show to a student.
 */

export class RequestError extends Error {
  status: number;
  kind: string;

  constructor(message: string, status = 500, kind = 'error') {
    super(message);
    this.name = 'RequestError';
    this.status = status;
    this.kind = kind;
  }
}

export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(init?.headers || {}) },
    });
  } catch {
    throw new RequestError('Could not reach the ClassRelay server. Check that it is running.', 0, 'offline');
  }
  let data: unknown = null;
  const text = await res.text();
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      /* a non-JSON error page */
    }
  }
  if (!res.ok) {
    const message =
      (data as { error?: string } | null)?.error ??
      (res.status === 404 ? 'That page or resource was not found.' : `The server returned an error (${res.status}).`);
    throw new RequestError(message, res.status, res.status === 429 ? 'rate-limit' : 'error');
  }
  return data as T;
}

/** Runs one AI task. `task` is one of the names in `server/lib/tasks.js`. */
export function askTask<T>(task: string, payload: unknown, signal?: AbortSignal): Promise<T> {
  return request<T>('/api/task', {
    method: 'POST',
    body: JSON.stringify({ task, payload }),
    signal,
  });
}

export interface HealthInfo {
  ok: boolean;
  mode: 'live' | 'demo';
  provider: string | null;
  hasKey: boolean;
}

export function getHealth(): Promise<HealthInfo> {
  return request<HealthInfo>('/api/health');
}
