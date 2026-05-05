import { useCallback, useEffect, useState } from "react";

export function useAuth() {
  const [token, setToken] = useState("");
  const [isAuthed, setIsAuthed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const verifyToken = useCallback(async (savedToken: string) => {
    try {
      const response = await fetch("/api/admin/stats", {
        headers: { Authorization: `Bearer ${savedToken}` },
      });
      return response.ok;
    } catch {
      return false;
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const savedToken = localStorage.getItem("admin_token");
      if (savedToken && (await verifyToken(savedToken))) {
        setToken(savedToken);
        setIsAuthed(true);
      } else {
        localStorage.removeItem("admin_token");
      }
      setLoading(false);
    })();
  }, [verifyToken]);

  const login = useCallback(async (username: string, password: string) => {
    if (!username || !password) {
      setError("请输入用户名和密码");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = (await response.json()) as { token?: string; error?: { message?: string } };
      if (!response.ok || !data.token) {
        setError(data.error?.message ?? "登录失败");
        return;
      }
      localStorage.setItem("admin_token", data.token);
      setToken(data.token);
      setIsAuthed(true);
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
