import type { AuthSession, LoginCredentials } from '../types/auth';
import * as server from './mockServer';

/** The app's only door to authentication. Swap the body for fetch() to use a real backend. */
export function login({ email, password }: LoginCredentials): Promise<AuthSession> {
  return server.login(email, password);
}
