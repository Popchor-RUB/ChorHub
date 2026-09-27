import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Card, Spinner } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import { attendanceApi, memberAuthApi } from '../../services/api';
import { useAuthStore } from '../../store/authStore';
import { DisabledAccountNotice } from '../../components/auth/DisabledAccountNotice';
import { getDisabledAccountContact } from '../../utils/authErrors';

const isAttendanceResponse = (value: string | null): value is 'CONFIRMED' | 'DECLINED' =>
  value === 'CONFIRMED' || value === 'DECLINED';

export function MagicLinkVerifyPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setMemberSession } = useAuthStore();
  const [error, setError] = useState('');
  const [disabledContactEmail, setDisabledContactEmail] = useState<string | null>(null);
  const { t } = useTranslation();

  useEffect(() => {
    void Promise.resolve().then(async () => {
      const token = searchParams.get('token');
      if (!token) {
        setError(t('auth.error_no_token'));
        return;
      }

      const rehearsalId = searchParams.get('rehearsalId');
      const response = searchParams.get('response');

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
      } catch (error) {
        const contactEmail = getDisabledAccountContact(error);
        setError(contactEmail ? t('auth.error_member_disabled') : t('auth.error_invalid_link'));
        setDisabledContactEmail(contactEmail);
      }
    });
  }, [navigate, searchParams, setMemberSession, t]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-surface-secondary">
      <Card className="w-full max-w-md">
        <Card.Content className="text-center py-8">
          {error ? (
            <div>
              <p className="text-danger font-medium mb-2">{t('auth.login_failed')}</p>
              {disabledContactEmail
                ? <DisabledAccountNotice message={error} contactEmail={disabledContactEmail} />
                : <p className="text-muted text-sm">{error}</p>}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <Spinner size="lg" />
              <p className="text-muted">{t('auth.processing')}</p>
            </div>
          )}
        </Card.Content>
      </Card>
    </div>
  );
}
