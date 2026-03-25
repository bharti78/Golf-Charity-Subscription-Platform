import { createContext, useContext, useEffect, useState } from "react";
import { api } from "./api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => window.localStorage.getItem("golf_token"));
  const [user, setUser] = useState(() => {
    const raw = window.localStorage.getItem("golf_user");
    return raw ? JSON.parse(raw) : null;
  });

  useEffect(() => {
    if (token) {
      window.localStorage.setItem("golf_token", token);
    } else {
      window.localStorage.removeItem("golf_token");
    }
  }, [token]);

  useEffect(() => {
    if (user) {
      window.localStorage.setItem("golf_user", JSON.stringify(user));
    } else {
      window.localStorage.removeItem("golf_user");
    }
  }, [user]);

  const login = async (payload) => {
    const data = await api.login(payload);
    setToken(data.token);
    setUser(data.user);
    return data;
  };

  const signup = async (payload) => {
    const data = await api.signup(payload);
    setToken(data.token);
    setUser(data.user);
    return data;
  };

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ token, user, setUser, login, signup, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

