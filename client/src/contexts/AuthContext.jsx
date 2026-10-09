import { createContext, useContext, useEffect, useState } from "react";
import api from "../services/api";
const Context = createContext();
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    if (localStorage.getItem("kindred-token"))
      api
        .get("/auth/me")
        .then((r) => setUser(r.data))
        .catch(() => localStorage.removeItem("kindred-token"))
        .finally(() => setLoading(false));
    else setLoading(false);
  }, []);
  const login = (data) => {
    localStorage.setItem("kindred-token", data.token);
    setUser(data.user);
  };
  const logout = () => {
    localStorage.removeItem("kindred-token");
    setUser(null);
  };
  return (
    <Context.Provider value={{ user, loading, login, logout, setUser }}>
      {children}
    </Context.Provider>
  );
}
export const useAuth = () => useContext(Context);
