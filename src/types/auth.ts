export type User = {
  id: number;
  name: string;
  login: string;
  email: string;
  role: string;
  active: boolean;
  created_at?: string;
  updated_at?: string | null;
};

export type LoginResponse = {
  access_token: string;
  refresh_token: string;
  token_type: string;
};
