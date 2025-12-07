import {
  createContext,
  useContext,
  createSignal,
  createEffect,
  ParentComponent,
  JSX,
} from "solid-js";
import { verifyToken, isAuthenticated, logout as authLogout } from "~/lib/auth";

interface User {
  email: string;
  externalId: string;
}

interface AuthContextType {
  user: () => User | null;
  isLoading: () => boolean;
  isAuthenticated: () => boolean;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>();

export const AuthProvider: ParentComponent<{ children: JSX.Element }> = (
  props,
) => {
  const [user, setUser] = createSignal<User | null>(null);
  const [isLoading, setIsLoading] = createSignal(true);

  const checkAuth = async () => {
    if (!isAuthenticated()) {
      setUser(null);
      setIsLoading(false);
      return;
    }

    const userData = await verifyToken();
    setUser(userData);
    setIsLoading(false);
  };

  const logout = () => {
    authLogout();
    setUser(null);
  };

  const refreshUser = async () => {
    await checkAuth();
  };

  // Check authentication on mount
  createEffect(() => {
    checkAuth();
  });

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: () => user() !== null,
        logout,
        refreshUser,
      }}
    >
      {props.children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
