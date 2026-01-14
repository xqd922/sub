import { useState } from 'react'
import { Button, Input, Label, Card } from '@heroui/react'

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
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <div className="p-6 gap-4 flex flex-col">
          <h1 className="text-2xl font-bold text-center">管理面板</h1>

          {error && (
            <div className="bg-danger/10 text-danger p-3 rounded-lg text-sm">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-2">
            <Label htmlFor="username">用户名</Label>
            <Input
              id="username"
              type="text"
              placeholder="输入用户名"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              autoComplete="username"
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="password">密码</Label>
            <Input
              id="password"
              type="password"
              placeholder="输入密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading}
              autoComplete="current-password"
            />
          </div>

          <Button
            className="bg-primary text-white hover:bg-primary/90"
            onClick={handleSubmit}
            isDisabled={!username || !password || loading}
            fullWidth
          >
            {loading ? '登录中...' : '登录'}
          </Button>
        </div>
      </Card>
    </div>
  )
}
