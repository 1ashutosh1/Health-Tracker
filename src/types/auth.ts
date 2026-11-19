export interface User {
  id: string;
  email: string;
  name: string;
}

export interface LoginCredentials {
  email: string;
  password: string;
}

/** What a successful login returns. The token goes to secure storage, the user to authStore. */
export interface AuthSession {
  token: string;
  user: User;
}
