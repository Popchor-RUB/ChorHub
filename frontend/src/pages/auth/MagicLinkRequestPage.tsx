import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardBody, CardHeader, Input, Button } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import axios from 'axios';
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
  const { visible: showGuide, forced: guideForced, dismiss: dismissGuide } = useIOSInstallGuide('chorhub-ios-guide-login');
  const { t } = useTranslation();

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
      if (trimmed.toLowerCase() === 'admin') {
        navigate('/admin/login', { replace: true });
        return;
      }
      if (isToken(trimmed)) {
        const res = await memberAuthApi.verifyMagicLink(trimmed);
        handleSession(res.data.token, res.data.member);
      } else {
        await memberAuthApi.requestMagicLink(trimmed);
        setView('code');
      }
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 401) {
        setError(t('auth.error_invalid_credentials'));
      } else {
        setError(t('common.error_generic'));
      }
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
      setError(t('auth.error_invalid_code'));
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
      {showGuide && <IOSInstallGuide forced={guideForced} onDismiss={dismissGuide} />}
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-col items-start gap-1 pb-0">
          <h1 className="text-2xl font-bold">{t('auth.member_title')}</h1>
          <p className="text-default-500">{t('auth.member_subtitle')}</p>
        </CardHeader>
        <CardBody>
          {view === 'email' ? (
            <form onSubmit={handleEmailSubmit} className="flex flex-col gap-4">
              <p className="text-default-600 text-sm">
                {t('auth.email_instruction')}
              </p>
              <Input
                type="text"
                label={t('auth.email_label')}
                value={email}
                onValueChange={setEmail}
                isRequired
                placeholder={t('auth.email_placeholder')}
                autoComplete="email"
                autoCorrect="off"
                autoCapitalize="none"
              />
              {error && <p className="text-danger text-sm">{error}</p>}
              <Button type="submit" color="primary" isLoading={loading} fullWidth>
                {isToken(email.trim()) ? t('auth.login') : t('auth.continue')}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleCodeSubmit} className="flex flex-col gap-4">
              <p
                className="text-default-600 text-sm"
                dangerouslySetInnerHTML={{
                  __html: t('auth.email_sent', { email: email.trim() }),
                }}
              />
              <p
                className="text-default-600 text-sm"
                dangerouslySetInnerHTML={{ __html: t('auth.code_instruction') }}
              />
              <Input
                type="text"
                inputMode="numeric"
                label={t('auth.code_label')}
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
                {t('auth.login')}
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="flat"
                  onPress={() => { setView('email'); setCode(''); setError(''); }}
                  fullWidth
                >
                  {t('common.back')}
                </Button>
                <Button variant="flat" onPress={handleResend} isLoading={loading} fullWidth>
                  {t('auth.resend')}
                </Button>
              </div>
            </form>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
