import { useEffect, useState } from 'react';
import { Button, Spinner } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import { settingsApi } from '../../services/api';

type CloudLoadState = 'loading' | 'error' | 'empty' | 'ready';

export function MemberCloudPage() {
  const { t } = useTranslation();
  const [url, setUrl] = useState<string | null>(null);
  const [state, setState] = useState<CloudLoadState>('loading');
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let current = true;
    settingsApi.get('cloud.url').then((response) => {
      if (!current) return;
      const cloudUrl = response.data.value?.trim() ?? '';
      setUrl(cloudUrl || null);
      setState(cloudUrl ? 'ready' : 'empty');
    }).catch(() => {
      if (!current) return;
      setUrl(null);
      setState('error');
    });
    return () => { current = false; };
  }, [reloadCount]);

  if (state === 'loading') {
    return (
      <div className="flex h-full min-h-0 items-center justify-center" role="status">
        <Spinner aria-label={t('cloud.loading')} />
      </div>
    );
  }

  if (state === 'error') {
    return (
      <div className="flex h-full min-h-0 flex-col items-center justify-center gap-3 px-4 text-center">
        <p role="alert" className="text-sm text-danger">{t('cloud.load_error')}</p>
        <Button variant="secondary" onPress={() => { setState('loading'); setReloadCount((count) => count + 1); }}>{t('cloud.retry')}</Button>
      </div>
    );
  }

  if (state === 'empty' || !url) {
    return (
      <div className="flex h-full min-h-0 items-center justify-center px-4 text-center">
        <p className="text-sm text-muted">{t('cloud.empty')}</p>
      </div>
    );
  }

  return (
    <iframe
      id="cloud-frame"
      data-testid="cloud-frame"
      className="block h-full min-h-0 w-full border-0"
      src={url}
      title={t('cloud.frame_title')}
    />
  );
}
