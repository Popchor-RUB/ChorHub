import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Card, Input, Label, Spinner, TextField } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import { adminApi } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

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
    <div className="min-h-screen flex items-center justify-center p-4 bg-surface-secondary">
      <Card className="w-full max-w-md">
        <Card.Header className="flex flex-col items-start gap-1 pb-0">
          <Card.Title>{t('auth.admin_title')}</Card.Title>
          <Card.Description>{t('auth.admin_subtitle')}</Card.Description>
        </Card.Header>
        <Card.Content>
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <TextField
              className="w-full"
              variant="secondary"
              value={username}
              onChange={setUsername}
              isRequired
            >
              <Label>{t('auth.username')}</Label>
              <Input autoComplete="username" />
            </TextField>
            <TextField
              className="w-full"
              variant="secondary"
              type="password"
              value={password}
              onChange={setPassword}
            >
              <Label>{t('auth.password')}</Label>
              <Input autoComplete="current-password" />
            </TextField>
            {error && <p className="text-danger text-sm">{error}</p>}
            <Button type="submit" isPending={loading} fullWidth>
              {({ isPending }) => <>{isPending && <Spinner color="current" size="sm" />}{t('auth.login')}</>}
            </Button>
          </form>
        </Card.Content>
      </Card>
    </div>
  );
}
