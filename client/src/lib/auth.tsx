import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { useLocation } from "wouter";
import * as api from "./api";

export interface AppUser {
  id: string;
  email: string;
  name: string;
  role: "Admin" | "User";
}

interface AuthContextType {
  user: AppUser | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  loading: boolean;
  users: AppUser[];
  addUser: (user: Omit<AppUser, "id"> & { password: string }) => Promise<void>;
  removeUser: (id: string) => Promise<void>;
  fetchUsers: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [, setLocation] = useLocation();

  // Check for existing session on mount
  useEffect(() => {
    api.getCurrentUser()
      .then(({ user }) => setUser(user))
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  const login = async (email: string, password: string) => {
    try {
      const { user: loggedInUser } = await api.loginUser(email, password);
      setUser(loggedInUser);
      return true;
    } catch (error) {
      console.error("Login failed:", error);
      return false;
    }
  };

  const logout = async () => {
    try {
      await api.logoutUser();
      setUser(null);
      setLocation("/login");
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const fetchUsers = async () => {
    try {
      const fetchedUsers = await api.fetchUsers();
      setUsers(fetchedUsers);
    } catch (error) {
      console.error("Failed to fetch users:", error);
      throw error; // Re-throw so callers can handle the error
    }
  };

  const addUser = async (newUser: Omit<AppUser, "id"> & { password: string }) => {
    try {
      const created = await api.createUser(newUser);
      setUsers([...users, created]);
    } catch (error) {
      console.error("Failed to add user:", error);
      throw error;
    }
  };

  const removeUser = async (id: string) => {
    try {
      await api.deleteUser(id);
      setUsers(users.filter(u => u.id !== id));
    } catch (error) {
      console.error("Failed to remove user:", error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading, users, addUser, removeUser, fetchUsers }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
