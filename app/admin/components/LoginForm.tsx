import { Alert, Button, Card, Form, Input, Typography } from '@arco-design/web-react'
import { useState } from 'react'

const { Text } = Typography

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
    <div className="admin-login-screen admin-root">
      <Card className="admin-login-card" bordered>
        <div className="admin-login-brand">S</div>
        <h1 className="login-title">SubOps Console</h1>
        <Text className="login-subtitle">登录后管理订阅转换、短链和运行状态</Text>

        {error && (
          <Alert className="login-alert" type="error" content={error} />
        )}

        <Form layout="vertical" className="login-form">
          <Form.Item label="用户名" required>
            <Input
              value={username}
              disabled={loading}
              autoComplete="username"
              placeholder="输入用户名"
              onChange={setUsername}
            />
          </Form.Item>

          <Form.Item label="密码" required>
            <Input.Password
              value={password}
              disabled={loading}
              autoComplete="current-password"
              placeholder="输入密码"
              onChange={setPassword}
              onPressEnter={() => {
                if (username && password && !loading) void handleSubmit()
              }}
            />
          </Form.Item>

          <Button
            long
            type="primary"
            loading={loading}
            disabled={!username || !password}
            onClick={() => void handleSubmit()}
          >
            登录
          </Button>
        </Form>
      </Card>
    </div>
  )
}
