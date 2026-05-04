import { Alert, Button, Checkbox, Form, Input, Typography } from '@arco-design/web-react'
import { useState } from 'react'
import { BrandMark } from '@/src/ui/shared/BrandMark'

const { Text } = Typography

interface LoginFormProps {
  onLogin: (username: string, password: string) => Promise<void>
  loading: boolean
  error: string
}

export function LoginForm({ onLogin, loading, error }: LoginFormProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [rememberSession, setRememberSession] = useState(true)

  const handleSubmit = async () => {
    await onLogin(username, password)
  }

  return (
    <div className="admin-login-split admin-root">
      <section className="login-hero-panel">
        <div className="login-hero-content">
          <BrandMark className="login-hero-icon" />
          <h1>Welcome to SubOps</h1>
          <p>
            一个用于管理订阅转换、短链接和 Edge 运行状态的控制台。
          </p>
        </div>
      </section>

      <section className="login-form-panel">
        <div className="login-form-wrap">
          <h2 className="login-heading">Login to Admin</h2>
          <Text className="login-subtitle">Manage your subscription conversion service</Text>

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

            <Checkbox checked={rememberSession} onChange={setRememberSession}>
              保持登录状态
            </Checkbox>

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
        </div>
      </section>
    </div>
  )
}
