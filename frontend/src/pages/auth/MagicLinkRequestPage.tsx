import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardBody, CardHeader, Input, Button } from '@heroui/react';
import { memberAuthApi } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { IOSInstallGuide } from '../../components/IOSInstallGuide';
import { useIOSInstallGuide } from '../../hooks/useIOSInstallGuide';

const isToken = (v: string) => /^[0-9a-f]{64}$/i.test(v);

type View = 'email' | 'code';

export function MagicLinkRequestPage() {
  const [view, setView] = useState<View>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { setMemberSession } = useAuthStore();
  const { visible: showGuide, dismiss: dismissGuide } = useIOSInstallGuide('chorhub-ios-guide-login');

  const handleSession = (token: string, member: { id: string; firstName: string; lastName: string }) => {
    setMemberSession({
      token,
      memberId: member.id,
      firstName: member.firstName,
      lastName: member.lastName,
    });
    navigate('/', { replace: true });
  };

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const trimmed = email.trim();
    try {
      if (isToken(trimmed)) {
        const res = await memberAuthApi.verifyMagicLink(trimmed);
        handleSession(res.data.token, res.data.member);
      } else {
        await memberAuthApi.requestMagicLink(trimmed);
        setView('code');
      }
    } catch {
      setError('Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.');
    } finally {
      setLoading(false);
    }
  };

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await memberAuthApi.verifyCode(email.trim(), code.trim());
      handleSession(res.data.token, res.data.member);
    } catch {
      setError('Ungültiger oder abgelaufener Code. Bitte prüfen Sie die Eingabe.');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    setLoading(true);
    setError('');
    setCode('');
    try {
      await memberAuthApi.requestMagicLink(email.trim());
    } catch {
      // Silent — same security policy as backend
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-default-50">
      {showGuide && <IOSInstallGuide onDismiss={dismissGuide} />}
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-col items-start gap-1 pb-0">
          <h1 className="text-2xl font-bold">ChorHub</h1>
          <p className="text-default-500">Mitglieder-Anmeldung</p>
        </CardHeader>
        <CardBody>
          {view === 'email' ? (
            <form onSubmit={handleEmailSubmit} className="flex flex-col gap-4">
              <p className="text-default-600 text-sm">
                Geben Sie Ihre E-Mail-Adresse ein. Sie erhalten dann einen Anmeldelink und einen 6-stelligen Code.
              </p>
              <Input
                type="text"
                label="E-Mail-Adresse oder Token"
                value={email}
                onValueChange={setEmail}
                isRequired
                placeholder="ihre@email.de"
                autoComplete="email"
                autoCorrect="off"
                autoCapitalize="none"
              />
              {error && <p className="text-danger text-sm">{error}</p>}
              <Button type="submit" color="primary" isLoading={loading} fullWidth>
                {isToken(email.trim()) ? 'Anmelden' : 'Weiter'}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleCodeSubmit} className="flex flex-col gap-4">
              <p className="text-default-600 text-sm">
                Eine E-Mail wurde an <strong>{email.trim()}</strong> gesendet.
              </p>
              <p className="text-default-600 text-sm">
                Geben Sie den <strong>6-stelligen Code</strong> aus der E-Mail ein. Der Code ist 15 Minuten gültig.
                Alternativ können Sie auch den Link in der E-Mail direkt öffnen.
              </p>
              <Input
                type="text"
                inputMode="numeric"
                label="6-stelliger Code"
                value={code}
                onValueChange={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
                isRequired
                placeholder="123456"
                autoComplete="one-time-code"
                maxLength={6}
                classNames={{ input: 'text-center text-2xl tracking-[0.5em] font-mono' }}
              />
              {error && <p className="text-danger text-sm">{error}</p>}
              <Button type="submit" color="primary" isLoading={loading} isDisabled={code.length !== 6} fullWidth>
                Anmelden
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="flat"
                  onPress={() => { setView('email'); setCode(''); setError(''); }}
                  fullWidth
                >
                  Zurück
                </Button>
                <Button variant="flat" onPress={handleResend} isLoading={loading} fullWidth>
                  Erneut senden
                </Button>
              </div>
            </form>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
