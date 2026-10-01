import { CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';
import { Button } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import type { AttendanceResponse } from '../../types';

export function AttendanceResponseResult({ result }: { result: AttendanceResponse | 'FAILED' }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const failed = result === 'FAILED';
  const Icon = failed ? ExclamationCircleIcon : CheckCircleIcon;

  return (
    <div className="flex flex-col items-center gap-4" role={failed ? 'alert' : 'status'}>
      <Icon aria-hidden="true" className={`h-12 w-12 ${failed ? 'text-danger' : 'text-success'}`} />
      <h1 className="text-xl font-semibold">
        {t(failed ? 'auth.attendance_failed' : 'auth.attendance_saved')}
      </h1>
      <p className="text-muted text-sm">
        {t(failed
          ? 'auth.error_attendance_response'
          : result === 'CONFIRMED' ? 'auth.attendance_confirmed' : 'auth.attendance_declined')}
      </p>
      {!failed && <p className="text-muted text-sm">{t('auth.attendance_close_hint')}</p>}
      <Button variant="secondary" onPress={() => navigate('/proben', { replace: true })}>
        {t('auth.open_rehearsals')}
      </Button>
    </div>
  );
}
