export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  timestamp: string;
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrev: boolean;
  };
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, any>;
  timestamp: string;
  requestId?: string;
}

export interface RequestConfig {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  url: string;
  headers?: Record<string, string>;
  params?: Record<string, any>;
  data?: any;
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

export interface WebSocketMessage<T = any> {
  type: string;
  channel?: string;
  data: T;
  timestamp: string;
  requestId?: string;
}

export interface WebSocketSubscription {
  channel: string;
  params?: Record<string, any>;
  callback: (data: any) => void;
}

export interface ApiState {
  isOnline: boolean;
  lastSync: string;
  pendingRequests: number;
  rateLimitRemaining: number;
  rateLimitReset: string;
}

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';

export interface ApiEndpoint {
  method: HttpMethod;
  path: string;
  authenticated?: boolean;
  rateLimit?: number;
  timeout?: number;
}