import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, CardBody, Spinner } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import { attendanceApi, memberAuthApi } from '../../services/api';
import { useAuthStore } from '../../store/authStore';

const isAttendanceResponse = (value: string | null): value is 'CONFIRMED' | 'DECLINED' =>
  value === 'CONFIRMED' || value === 'DECLINED';

export function MagicLinkVerifyPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setMemberSession } = useAuthStore();
  const [error, setError] = useState('');
  const { t } = useTranslation();

  useEffect(() => {
    const token = searchParams.get('token');
    if (!token) {
      setError(t('auth.error_no_token'));
      return;
    }

    const rehearsalId = searchParams.get('rehearsalId');
    const response = searchParams.get('response');

    const run = async () => {
      try {
        const res = await memberAuthApi.verifyMagicLink(token);
        const { token: rawToken, member } = res.data;
        setMemberSession({
          token: rawToken,
          memberId: member.id,
          firstName: member.firstName,
          lastName: member.lastName,
        });

        if (rehearsalId && isAttendanceResponse(response)) {
          try {
            await attendanceApi.setPlan(rehearsalId, response);
          } catch {
            // Keep login successful even when RSVP action can no longer be applied.
          }
        }

        navigate('/proben', { replace: true });
      } catch {
        setError(t('auth.error_invalid_link'));
      }
    };

    void run();
  }, [navigate, searchParams, setMemberSession, t]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-default-50">
      <Card className="w-full max-w-md">
        <CardBody className="text-center py-8">
          {error ? (
            <div>
              <p className="text-danger font-medium mb-2">{t('auth.login_failed')}</p>
              <p className="text-default-600 text-sm">{error}</p>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <Spinner size="lg" />
              <p className="text-default-600">{t('auth.processing')}</p>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
