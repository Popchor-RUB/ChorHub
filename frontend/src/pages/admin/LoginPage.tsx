import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardBody, CardHeader, Input, Button, Divider } from '@heroui/react';
import { adminApi } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { startAuthentication } from '@simplewebauthn/browser';

export function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [passkeyLoading, setPasskeyLoading] = useState(false);
  const [error, setError] = useState('');
  const { setAdminSession } = useAuthStore();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await adminApi.login(username, password);
      setAdminSession({ token: res.data.token, username });
      navigate('/admin/mitglieder', { replace: true });
    } catch {
      setError('Ungültige Anmeldedaten.');
    } finally {
      setLoading(false);
    }
  };

  const handlePasskey = async () => {
    if (!username) {
      setError('Bitte Benutzername eingeben.');
      return;
    }
    setPasskeyLoading(true);
    setError('');
    try {
      const challengeRes = await adminApi.passkeyChallenge(username);
      const { options, adminId } = challengeRes.data;
      const assertion = await startAuthentication({ optionsJSON: options });
      const verifyRes = await adminApi.passkeyVerify(adminId, assertion);
      setAdminSession({ token: verifyRes.data.token, username });
      navigate('/admin/mitglieder', { replace: true });
    } catch (e: any) {
      setError(e.message?.includes('options') ? 'Passkey nicht gefunden.' : 'Passkey-Anmeldung fehlgeschlagen.');
    } finally {
      setPasskeyLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-default-50">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-col items-start gap-1 pb-0">
          <h1 className="text-2xl font-bold">ChorHub Admin</h1>
          <p className="text-default-500 text-sm">Administratoren-Anmeldung</p>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <Input
              label="Benutzername"
              value={username}
              onValueChange={setUsername}
              isRequired
              autoComplete="username"
            />
            <Input
              label="Passwort"
              type="password"
              value={password}
              onValueChange={setPassword}
              autoComplete="current-password"
            />
            {error && <p className="text-danger text-sm">{error}</p>}
            <Button type="submit" color="primary" isLoading={loading} fullWidth>
              Anmelden
            </Button>
          </form>

          <Divider className="my-4" />

          <Button
            variant="bordered"
            onPress={handlePasskey}
            isLoading={passkeyLoading}
            fullWidth
            startContent={<span>🔑</span>}
          >
            Mit Passkey anmelden
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}
