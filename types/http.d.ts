/**
 * HTTP Client — fetch-based wrapper with interceptors and auto-JSON.
 *
 * @module http
 */

/** The response object resolved by all HTTP request methods (except `raw`). */
export interface HttpResponse<T = any> {
  /** `true` if status 200-299. */
  ok: boolean;
  /** HTTP status code. */
  status: number;
  /** HTTP status text. */
  statusText: string;
  /** Response headers as a plain object. */
  headers: Record<string, string>;
  /** Auto-parsed body (JSON, text, or Blob depending on content type). */
  data: T;
  /** Raw `fetch` Response object. */
  response: Response;
}

/** Per-request options passed to HTTP methods. */
export interface HttpRequestOptions extends Omit<RequestInit, 'body' | 'method'> {
  /** Additional headers (merged with defaults). */
  headers?: Record<string, string>;
  /** Override default timeout (ms). */
  timeout?: number;
  /** Abort signal for cancellation. */
  signal?: AbortSignal;
}

/** Global HTTP configuration options. */
export interface HttpConfigureOptions {
  /** Prepended to non-absolute URLs. */
  baseURL?: string;
  /** Default headers (merged, not replaced). */
  headers?: Record<string, string>;
  /** Default timeout in ms (default 30 000). Set `0` to disable. */
  timeout?: number;
}

/** Request interceptor function. */
export type HttpRequestInterceptor = (
  fetchOpts: RequestInit & { headers: Record<string, string> },
  url: string,
) => void | false | { url?: string; options?: RequestInit } | Promise<void | false | { url?: string; options?: RequestInit }>;

/** Response interceptor function. */
export type HttpResponseInterceptor = (result: HttpResponse) => void | Promise<void>;

/** The `$.http` namespace. */
export interface HttpClient {
  /** GET request. `params` appended as query string. */
  get<T = any>(url: string, params?: Record<string, any> | null, opts?: HttpRequestOptions): Promise<HttpResponse<T>>;
  /** POST request. `data` sent as JSON body (or FormData). */
  post<T = any>(url: string, data?: any, opts?: HttpRequestOptions): Promise<HttpResponse<T>>;
  /** PUT request. */
  put<T = any>(url: string, data?: any, opts?: HttpRequestOptions): Promise<HttpResponse<T>>;
  /** PATCH request. */
  patch<T = any>(url: string, data?: any, opts?: HttpRequestOptions): Promise<HttpResponse<T>>;
  /** DELETE request. */
  delete<T = any>(url: string, data?: any, opts?: HttpRequestOptions): Promise<HttpResponse<T>>;

  /** Update default configuration for all subsequent requests. */
  configure(options: HttpConfigureOptions): void;

  /** Add a request interceptor (called before every request). */
  onRequest(fn: HttpRequestInterceptor): void;

  /** Add a response interceptor (called after every response, before error check). */
  onResponse(fn: HttpResponseInterceptor): void;

  /** Create a new `AbortController` for manual request cancellation. */
  createAbort(): AbortController;

  /** Direct passthrough to native `fetch()` — no JSON handling, no interceptors. */
  raw(url: string, opts?: RequestInit): Promise<Response>;
}

export declare const http: HttpClient;
