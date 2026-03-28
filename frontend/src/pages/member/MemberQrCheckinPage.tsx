import { useCallback, useEffect, useRef, useState } from 'react';
import { Spinner } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import { checkinApi } from '../../services/api';

const QR_REFRESH_SECONDS = 120;

function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function MemberQrCheckinPage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(QR_REFRESH_SECONDS);
  const isFetchingRef = useRef(false);

  const loadQr = useCallback(async (showLoading = false) => {
    if (isFetchingRef.current) return;

    isFetchingRef.current = true;
    if (showLoading) setLoading(true);
    setError('');

    try {
      const res = await checkinApi.getMemberQr();
      setQrCodeDataUrl(res.data.qrCodeDataUrl);
      setRemainingSeconds(QR_REFRESH_SECONDS);
    } catch {
      setError(t('checkin.member_load_error'));
    } finally {
      if (showLoading) setLoading(false);
      isFetchingRef.current = false;
    }
  }, [t]);

  useEffect(() => {
    void loadQr(true);
  }, [loadQr]);

  useEffect(() => {
    if (loading || !qrCodeDataUrl) return;

    const intervalId = window.setInterval(() => {
      setRemainingSeconds((currentSeconds) => {
        if (currentSeconds <= 1) {
          void loadQr();
          return QR_REFRESH_SECONDS;
        }

        return currentSeconds - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loading, qrCodeDataUrl, loadQr]);

  const progressPercent = (remainingSeconds / QR_REFRESH_SECONDS) * 100;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{t('checkin.member_title')}</h1>
      <p className="text-sm text-default-500">{t('checkin.member_hint')}</p>

      <div className="flex flex-col items-center gap-4">
        {loading && !qrCodeDataUrl && <Spinner size="lg" />}

        {qrCodeDataUrl && (
          <>
            <img
              src={qrCodeDataUrl}
              alt={t('checkin.member_qr_alt')}
              className="w-full max-w-[340px] h-auto"
            />

            <div className="w-full max-w-[340px] flex flex-col gap-2">
              <div className="h-2 rounded-full bg-default-200 overflow-hidden" aria-hidden="true">
                <div
                  className="h-full bg-primary transition-[width] duration-1000 ease-linear"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <p className="text-xs text-default-500 text-center">
                {t('checkin.member_refresh_in', { time: formatCountdown(remainingSeconds) })}
              </p>
            </div>
          </>
        )}

        {error && (
          <p className="text-danger text-sm text-center">{error}</p>
        )}
      </div>
    </div>
  );
}
