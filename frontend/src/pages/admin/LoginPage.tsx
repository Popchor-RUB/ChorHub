import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardBody, CardHeader, Input, Button } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import { adminApi } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { adminInputClassNames } from '../../styles/adminFormStyles';

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { setAdminSession } = useAuthStore();
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await adminApi.login(username, password);
      setAdminSession({ token: res.data.token, username });
      navigate('/admin/mitglieder', { replace: true });
    } catch {
      setError(t('auth.error_invalid_credentials'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-default-50">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-col items-start gap-1 pb-0">
          <h1 className="text-2xl font-bold">{t('auth.admin_title')}</h1>
          <p className="text-default-500 text-sm">{t('auth.admin_subtitle')}</p>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <Input
              label={t('auth.username')}
              value={username}
              onValueChange={setUsername}
              isRequired
              autoComplete="username"
              classNames={adminInputClassNames}
            />
            <Input
              label={t('auth.password')}
              type="password"
              value={password}
              onValueChange={setPassword}
              autoComplete="current-password"
              classNames={adminInputClassNames}
            />
            {error && <p className="text-danger text-sm">{error}</p>}
            <Button type="submit" color="primary" isLoading={loading} fullWidth>
              {t('auth.login')}
            </Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
