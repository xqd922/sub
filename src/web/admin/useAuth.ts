import { useCallback, useEffect, useState } from "react";

interface UseAuthReturn {
  isAuthed: boolean;
  token: string;
  loading: boolean;
  error: string;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

export function useAuth(): UseAuthReturn {
  const [token, setToken] = useState("");
  const [isAuthed, setIsAuthed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const verifyToken = useCallback(async (savedToken: string): Promise<boolean> => {
    try {
      const res = await fetch("/api/admin/stats", {
        headers: { Authorization: `Bearer ${savedToken}` },
      });
      return res.ok;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    const initAuth = async () => {
      const savedToken = localStorage.getItem("admin_token");
      if (savedToken) {
        const isValid = await verifyToken(savedToken);
        if (isValid) {
          setToken(savedToken);
          setIsAuthed(true);
        } else {
          localStorage.removeItem("admin_token");
        }
      }
      setLoading(false);
    };
    initAuth();
  }, [verifyToken]);

  const login = useCallback(async (username: string, password: string) => {
    if (!username || !password) {
      setError("请输入用户名和密码");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = (await res.json()) as {
        success?: boolean;
        token?: string;
        error?: string;
      };

      if (!res.ok || !data.success) {
        setError(data.error || "登录失败");
        return;
      }

      const newToken = data.token || "";
      setToken(newToken);
      localStorage.setItem("admin_token", newToken);
      setIsAuthed(true);
      setError("");
    } catch {
      setError("登录请求失败");
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("admin_token");
    setToken("");
    setIsAuthed(false);
    setError("");
  }, []);

  return { isAuthed, token, loading, error, login, logout };
}
