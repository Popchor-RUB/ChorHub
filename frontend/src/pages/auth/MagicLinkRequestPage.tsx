import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardBody, CardHeader, Input, Button } from '@heroui/react';
import { memberAuthApi } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { IOSInstallGuide } from '../../components/IOSInstallGuide';
import { useIOSInstallGuide } from '../../hooks/useIOSInstallGuide';

const isToken = (v: string) => /^[0-9a-f]{64}$/i.test(v);

export function MagicLinkRequestPage() {
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { setMemberSession } = useAuthStore();
  const { visible: showGuide, dismiss: dismissGuide } = useIOSInstallGuide('chorhub-ios-guide-login');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const trimmed = value.trim();
    try {
      if (isToken(trimmed)) {
        const res = await memberAuthApi.verifyMagicLink(trimmed);
        const { token: rawToken, member } = res.data;
        setMemberSession({
          token: rawToken,
          memberId: member.id,
          firstName: member.firstName,
          lastName: member.lastName,
          choirVoice: member.choirVoice,
        });
        navigate('/', { replace: true });
      } else {
        await memberAuthApi.requestMagicLink(trimmed);
        setSent(true);
      }
    } catch {
      setError('Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.');
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
          {sent ? (
            <div className="text-center py-4">
              <p className="text-success font-medium mb-2">E-Mail versendet!</p>
              <p className="text-default-600 text-sm mb-4">
                Falls Ihre E-Mail-Adresse bekannt ist, erhalten Sie in Kürze eine E-Mail.
                Klicken Sie auf den Link oder kopieren Sie den Token aus der E-Mail und fügen Sie ihn hier ein.
              </p>
              <Button variant="flat" onPress={() => { setSent(false); setValue(''); }} fullWidth>
                Zurück
              </Button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <p className="text-default-600 text-sm">
                Geben Sie Ihre E-Mail-Adresse ein oder fügen Sie den Token aus der Anmelde-E-Mail direkt ein.
              </p>
              <Input
                type="text"
                label="E-Mail-Adresse oder Token"
                value={value}
                onValueChange={setValue}
                isRequired
                placeholder="ihre@email.de"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
              />
              {error && <p className="text-danger text-sm">{error}</p>}
              <Button type="submit" color="primary" isLoading={loading} fullWidth>
                {isToken(value.trim()) ? 'Anmelden' : 'Anmeldelink anfordern'}
              </Button>
            </form>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
