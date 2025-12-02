import { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { AppUser, mockUsers } from "./mockData";
import { useLocation } from "wouter";

interface AuthContextType {
  user: AppUser | null;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  users: AppUser[];
  addUser: (user: Omit<AppUser, "id">) => void;
  removeUser: (id: string) => void;
  updateUser: (id: string, data: Partial<AppUser>) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  // Load user from localStorage if present to persist across refreshes
  const [user, setUser] = useState<AppUser | null>(() => {
    const saved = localStorage.getItem("legalflow_user");
    return saved ? JSON.parse(saved) : null;
  });

  // Maintain local state of users (mocking database)
  const [users, setUsers] = useState<AppUser[]>(mockUsers);
  const [, setLocation] = useLocation();

  const login = async (email: string, password: string) => {
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const foundUser = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
    
    if (foundUser) {
      const { password, ...safeUser } = foundUser;
      setUser(foundUser); // In a real app, don't store password in state
      localStorage.setItem("legalflow_user", JSON.stringify(safeUser));
      return true;
    }
    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem("legalflow_user");
    setLocation("/login");
  };

  const addUser = (newUser: Omit<AppUser, "id">) => {
    const userWithId = { ...newUser, id: Math.random().toString(36).substr(2, 9) };
    setUsers([...users, userWithId]);
  };

  const removeUser = (id: string) => {
    setUsers(users.filter(u => u.id !== id));
  };

  const updateUser = (id: string, data: Partial<AppUser>) => {
    setUsers(users.map(u => u.id === id ? { ...u, ...data } : u));
    // If updating current user, update state
    if (user && user.id === id) {
      const updated = { ...user, ...data };
      setUser(updated);
      localStorage.setItem("legalflow_user", JSON.stringify(updated));
    }
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, users, addUser, removeUser, updateUser }}>
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
