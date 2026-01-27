import { useState } from 'react'
import { TextField, Input, Label, Button, Alert } from '@heroui/react'

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

  return (
    <div className="admin-root login-container">
      <div className="login-card">
        <h1 className="login-title">订阅管理</h1>
        <p className="login-subtitle">请登录以继续</p>

        <div className="login-form">
          {error && (
            <Alert status="danger">
              <Alert.Indicator />
              <Alert.Content>
                <Alert.Title>{error}</Alert.Title>
              </Alert.Content>
            </Alert>
          )}

          <TextField
            value={username}
            onChange={setUsername}
            isDisabled={loading}
            autoComplete="username"
          >
            <Label>用户名</Label>
            <Input placeholder="输入用户名" />
          </TextField>

          <TextField
            value={password}
            onChange={setPassword}
            isDisabled={loading}
            autoComplete="current-password"
            type="password"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && username && password && !loading) {
                handleSubmit()
              }
            }}
          >
            <Label>密码</Label>
            <Input placeholder="输入密码" />
          </TextField>

          <Button
            variant="primary"
            fullWidth
            onPress={handleSubmit}
            isDisabled={!username || !password || loading}
          >
            {loading ? '登录中...' : '登录'}
          </Button>
        </div>
      </div>
    </div>
  )
}
