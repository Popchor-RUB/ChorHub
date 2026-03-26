import { useEffect, useState } from 'react';
import { Button, Spinner } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import { checkinApi } from '../../services/api';

export function MemberQrCheckinPage() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string | null>(null);

  const loadQr = async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const res = await checkinApi.getMemberQr();
      setQrCodeDataUrl(res.data.qrCodeDataUrl);
    } catch {
      setError(t('checkin.member_load_error'));
    } finally {
      if (isRefresh) setRefreshing(false);
      else setLoading(false);
    }
  };

  useEffect(() => {
    void loadQr();
  }, []);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{t('checkin.member_title')}</h1>
      <p className="text-sm text-default-500">{t('checkin.member_hint')}</p>

      <div className="bg-background rounded-xl border border-divider p-4 sm:p-6 flex flex-col items-center gap-4">
        {loading && <Spinner size="lg" />}

        {!loading && qrCodeDataUrl && (
          <img
            src={qrCodeDataUrl}
            alt={t('checkin.member_qr_alt')}
            className="w-full max-w-[340px] h-auto"
          />
        )}

        {!loading && error && (
          <p className="text-danger text-sm text-center">{error}</p>
        )}

        <Button
          variant="flat"
          onPress={() => {
            void loadQr(true);
          }}
          isLoading={refreshing}
          isDisabled={loading}
        >
          {t('checkin.member_refresh')}
        </Button>
      </div>
    </div>
  );
}

