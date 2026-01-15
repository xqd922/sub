import { useState } from 'react'

interface LoginFormProps {
  onLogin: (username: string, password: string) => Promise<void>
  loading: boolean
  error: string
}

export function LoginForm({ onLogin, loading, error }: LoginFormProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = async () => {
    await onLogin(username, password)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && username && password && !loading) {
      handleSubmit()
    }
  }

  return (
    <div className="admin-root login-container">
      <div className="login-card">
        <h1 className="login-title">订阅管理</h1>
        <p className="login-subtitle">请登录以继续</p>

        <div className="login-form">
          {error && (
            <div className="login-error">{error}</div>
          )}

          <div className="form-field">
            <label htmlFor="username" className="form-label">用户名</label>
            <input
              id="username"
              type="text"
              className="form-input"
              placeholder="输入用户名"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              autoComplete="username"
            />
          </div>

          <div className="form-field">
            <label htmlFor="password" className="form-label">密码</label>
            <input
              id="password"
              type="password"
              className="form-input"
              placeholder="输入密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              autoComplete="current-password"
            />
          </div>

          <button
            className="login-btn"
            onClick={handleSubmit}
            disabled={!username || !password || loading}
          >
            {loading ? '登录中...' : '登录'}
          </button>
        </div>
      </div>
    </div>
  )
}
