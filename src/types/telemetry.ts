export type EventCategory = 'navigation' | 'trading' | 'ui' | 'error' | 'performance' | 'auth' | 'chart' | 'social';

export interface TelemetryEvent {
  eventId: string;
  userId?: string;
  sessionId: string;
  eventType: string;
  eventCategory: EventCategory;
  eventAction: string;
  eventLabel?: string;
  eventValue?: number;
  screenName?: string;
  previousScreen?: string;
  properties?: Record<string, any>;
  timestamp: string;
  localTimestamp: string;
  anonymized: boolean;
}

export interface DeviceInfo {
  platform: 'ios' | 'android' | 'web';
  appVersion: string;
  osVersion: string;
  deviceModel: string;
  screenSize: string;
  locale: string;
  timezone: string;
  userAgent?: string;
  networkType?: string;
  batteryLevel?: number;
  isCharging?: boolean;
  memoryUsage?: number;
}

export interface SessionInfo {
  sessionId: string;
  userId?: string;
  startTime: string;
  endTime?: string;
  duration?: number;
  screenViews: number;
  interactions: number;
  errors: number;
  crashes: number;
  deviceInfo: DeviceInfo;
}

export interface TelemetryBatchRequest {
  events: TelemetryEvent[];
  sessionInfo: SessionInfo;
  deviceInfo: DeviceInfo;
}

export interface TelemetrySettings {
  enabled: boolean;
  anonymizeData: boolean;
  collectPerformanceData: boolean;
  collectCrashReports: boolean;
  collectUsageAnalytics: boolean;
  shareWithThirdParties: boolean;
  dataRetentionDays: number;
}

export interface TelemetryState {
  settings: TelemetrySettings;
  sessionId: string;
  eventQueue: TelemetryEvent[];
  isOnline: boolean;
  lastSync: string;
  pendingEvents: number;
}

// Predefined event types for consistency
export const TELEMETRY_EVENTS = {
  // Navigation
  SCREEN_VIEW: 'screen_view',
  NAVIGATION: 'navigation',
  TAB_SWITCH: 'tab_switch',
  
  // Authentication
  LOGIN_ATTEMPT: 'login_attempt',
  LOGIN_SUCCESS: 'login_success',
  LOGIN_FAILURE: 'login_failure',
  LOGOUT: 'logout',
  REGISTER_ATTEMPT: 'register_attempt',
  REGISTER_SUCCESS: 'register_success',
  
  // Trading
  ORDER_PLACED: 'order_placed',
  ORDER_CANCELLED: 'order_cancelled',
  ORDER_FILLED: 'order_filled',
  POSITION_OPENED: 'position_opened',
  POSITION_CLOSED: 'position_closed',
  TP_SL_SET: 'tp_sl_set',
  ACCOUNT_RESET: 'account_reset',
  
  // Chart
  CHART_TIMEFRAME_CHANGED: 'chart_timeframe_changed',
  CHART_INDICATOR_ADDED: 'chart_indicator_added',
  CHART_DRAWING_TOOL_USED: 'chart_drawing_tool_used',
  CHART_ZOOM: 'chart_zoom',
  CHART_PAN: 'chart_pan',
  
  // UI Interactions
  BUTTON_CLICK: 'button_click',
  SWIPE: 'swipe',
  LONG_PRESS: 'long_press',
  PULL_TO_REFRESH: 'pull_to_refresh',
  
  // Performance
  APP_START: 'app_start',
  SCREEN_LOAD_TIME: 'screen_load_time',
  API_RESPONSE_TIME: 'api_response_time',
  CHART_RENDER_TIME: 'chart_render_time',
  
  // Errors
  API_ERROR: 'api_error',
  WEBSOCKET_ERROR: 'websocket_error',
  CHART_ERROR: 'chart_error',
  CRASH: 'crash',
  
  // Social
  LEADERBOARD_VIEW: 'leaderboard_view',
  PROFILE_VIEW: 'profile_view',
  ACHIEVEMENT_UNLOCKED: 'achievement_unlocked',
} as const;