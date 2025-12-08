import { createClient } from "@openauthjs/openauth/client";
import { subjects } from "./subjects";
import { clearEditorSessionFn } from "~/context/editor";

const ISSUER_URL = "http://localhost:5000";
const CLIENT_ID = "catatan-web";
const REDIRECT_URI = "http://localhost:3000/auth/callback";

// Storage keys
const ACCESS_TOKEN_KEY = "catatan_access_token";
const REFRESH_TOKEN_KEY = "catatan_refresh_token";

/**
 * Create OpenAuth client instance
 */
export const authClient = createClient({
  clientID: CLIENT_ID,
  issuer: ISSUER_URL,
});

/**
 * Token storage utilities
 */
export const tokenStorage = {
  getAccessToken: (): string | null => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(ACCESS_TOKEN_KEY);
  },

  getRefreshToken: (): string | null => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(REFRESH_TOKEN_KEY);
  },

  setTokens: (accessToken: string, refreshToken: string): void => {
    if (typeof window === "undefined") return;
    localStorage.setItem(ACCESS_TOKEN_KEY, accessToken);
    localStorage.setItem(REFRESH_TOKEN_KEY, refreshToken);
  },

  clearTokens: (): void => {
    if (typeof window === "undefined") return;
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
  },
};

/**
 * Initiate login by redirecting to OpenAuth
 */
export async function login(currentNoteId?: string | null) {
  try {
    if (currentNoteId) {
      localStorage.setItem("pending_claim_note_id", currentNoteId);
    }
    const { url } = await authClient.authorize(REDIRECT_URI, "code");
    window.location.href = url;
  } catch (error) {
    console.error("Failed to initiate login:", error);
    throw error;
  }
}

/**
 * Handle OAuth callback - exchange code for tokens
 */
export async function handleCallback(code: string): Promise<boolean> {
  try {
    console.log("Exchanging code for tokens...");
    const result = await authClient.exchange(code, REDIRECT_URI);
    console.log("Exchange result:", result);

    if ("err" in result && result.err) {
      console.error("Token exchange failed:", result.err);
      return false;
    }

    // OpenAuth client returns { err: false, tokens: { access, refresh, expiresIn } }
    if ("tokens" in result && result.tokens) {
      const { access, refresh } = result.tokens;
      console.log("Storing tokens:", {
        access: access.substring(0, 20) + "...",
        refresh,
      });
      tokenStorage.setTokens(access, refresh);
      console.log("Tokens stored successfully");
      return true;
    }

    console.error("Invalid token response format:", result);
    return false;
  } catch (error) {
    console.error("Failed to handle callback:", error);
    return false;
  }
}

/**
 * Logout - clear tokens
 */
export async function logout() {
  tokenStorage.clearTokens();
  await clearEditorSessionFn();
  window.location.href = "/";
}

/**
 * Verify current access token and get user info
 */
export async function verifyToken() {
  const accessToken = tokenStorage.getAccessToken();
  if (!accessToken) {
    return null;
  }

  try {
    const verified = await authClient.verify(subjects, accessToken);

    if ("err" in verified) {
      console.error("Token verification failed:", verified.err);
      return null;
    }

    console.log("Verified token subject:", verified.subject);

    return {
      email: verified.subject.properties.email,
      externalId: verified.subject.properties.external_id || "",
    };
  } catch (error) {
    console.error("Failed to verify token:", error);
    return null;
  }
}

/**
 * Refresh the access token using refresh token
 */
export async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = tokenStorage.getRefreshToken();
  if (!refreshToken) {
    return false;
  }

  try {
    const result = await authClient.refresh(refreshToken);

    if ("err" in result && result.err) {
      console.error("Token refresh failed:", result.err);
      tokenStorage.clearTokens();
      return false;
    }

    // OpenAuth client returns { err: false, tokens: { access, refresh, expiresIn } }
    if ("tokens" in result && result.tokens) {
      const { access, refresh } = result.tokens;
      tokenStorage.setTokens(access, refresh);
      return true;
    }

    tokenStorage.clearTokens();
    return false;
  } catch (error) {
    console.error("Failed to refresh token:", error);
    tokenStorage.clearTokens();
    return false;
  }
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return !!tokenStorage.getAccessToken();
}

/**
 * Get authorization header for API requests
 */
export function getAuthHeader(): Record<string, string> | null {
  const token = tokenStorage.getAccessToken();
  if (!token) {
    return null;
  }

  return {
    Authorization: `Bearer ${token}`,
  };
}
