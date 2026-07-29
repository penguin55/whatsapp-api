export interface Profile {
  username: string;
  csrf_token: string;
}

export interface Session {
  session_id: string;
  status: string;
  phone_number?: string | null;
  name?: string | null;
  last_connected?: string | null;
  created_at?: string;
  connected: boolean;
  hasQr: boolean;
}

export interface QrStatus {
  session_id: string;
  status: string;
  connected?: boolean;
  qr?: string | null;
  message?: string;
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
  error?: string;
}
