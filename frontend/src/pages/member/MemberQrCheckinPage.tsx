import { useCallback, useEffect, useRef, useState } from 'react';
import { Spinner } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import { checkinApi } from '../../services/api';

const QR_REFRESH_SECONDS = 60;

function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

export function MemberQrCheckinPage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [currentQrCodeDataUrl, setCurrentQrCodeDataUrl] = useState<string | null>(null);
  const [nextQrCodeDataUrl, setNextQrCodeDataUrl] = useState<string | null>(null);
  const [showNextQrOverlay, setShowNextQrOverlay] = useState(false);
  const [remainingSeconds, setRemainingSeconds] = useState(QR_REFRESH_SECONDS);
  const isFetchingRef = useRef(false);
  const currentQrCodeRef = useRef<string | null>(null);
  const queuedQrCodeRef = useRef<string | null>(null);

  useEffect(() => {
    currentQrCodeRef.current = currentQrCodeDataUrl;
  }, [currentQrCodeDataUrl]);

  useEffect(() => {
    queuedQrCodeRef.current = nextQrCodeDataUrl;
  }, [nextQrCodeDataUrl]);

  const preloadQrImage = useCallback((dataUrl: string) => (
    new Promise<void>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Failed to preload QR image'));
      image.src = dataUrl;
    })
  ), []);

  const loadQr = useCallback(async (showLoading = false) => {
    if (isFetchingRef.current) return;

    isFetchingRef.current = true;
    if (showLoading) setLoading(true);
    setError('');

    try {
      const res = await checkinApi.getMemberQr();
      const fetchedQrCodeDataUrl = res.data.qrCodeDataUrl;
      if (!currentQrCodeRef.current) {
        currentQrCodeRef.current = fetchedQrCodeDataUrl;
        setCurrentQrCodeDataUrl(fetchedQrCodeDataUrl);
      } else if (
        currentQrCodeRef.current !== fetchedQrCodeDataUrl &&
        queuedQrCodeRef.current !== fetchedQrCodeDataUrl
      ) {
        try {
          await preloadQrImage(fetchedQrCodeDataUrl);
        } catch {
          // Fall back to immediate swap if preloading fails.
        }
        queuedQrCodeRef.current = fetchedQrCodeDataUrl;
        setNextQrCodeDataUrl(fetchedQrCodeDataUrl);
      }
      setRemainingSeconds(QR_REFRESH_SECONDS);
    } catch {
      setError(t('checkin.member_load_error'));
    } finally {
      if (showLoading) setLoading(false);
      isFetchingRef.current = false;
    }
  }, [preloadQrImage, t]);

  useEffect(() => {
    void loadQr(true);
  }, [loadQr]);

  useEffect(() => {
    if (loading || !currentQrCodeDataUrl) return;

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
  }, [loading, currentQrCodeDataUrl, loadQr]);

  useEffect(() => {
    if (!nextQrCodeDataUrl || !currentQrCodeDataUrl) return;

    const animationFrameId = window.requestAnimationFrame(() => {
      setShowNextQrOverlay(true);
    });

    const timeoutId = window.setTimeout(() => {
      currentQrCodeRef.current = nextQrCodeDataUrl;
      queuedQrCodeRef.current = null;
      setCurrentQrCodeDataUrl(nextQrCodeDataUrl);
      setNextQrCodeDataUrl(null);
      setShowNextQrOverlay(false);
    }, 620);

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      window.clearTimeout(timeoutId);
    };
  }, [currentQrCodeDataUrl, nextQrCodeDataUrl]);

  const progressPercent = (remainingSeconds / QR_REFRESH_SECONDS) * 100;

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{t('checkin.member_title')}</h1>
      <p className="text-sm text-default-500">{t('checkin.member_hint')}</p>

      <div className="flex flex-col items-center gap-4">
        {loading && !currentQrCodeDataUrl && <Spinner size="lg" />}

        {currentQrCodeDataUrl && (
          <>
            <div className="w-full max-w-[360px] rounded-xl bg-white p-0 shadow-[0_0_16px_rgba(0,0,0,0.18)]">
              <div className="relative aspect-square overflow-hidden rounded-lg">
                <img
                  src={currentQrCodeDataUrl}
                  alt={t('checkin.member_qr_alt')}
                  className="absolute inset-0 w-full h-full"
                />
                {nextQrCodeDataUrl && (
                  <img
                    src={nextQrCodeDataUrl}
                    alt=""
                    aria-hidden="true"
                    className={`absolute inset-0 w-full h-full transition-opacity duration-[600ms] ease-in-out ${
                      showNextQrOverlay ? 'opacity-100' : 'opacity-0'
                    }`}
                  />
                )}
              </div>
            </div>

            <div className="w-full max-w-[360px] mt-4 flex flex-col gap-2">
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
