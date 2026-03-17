import { useEffect, useState } from 'react';
import { Button, Input, Spinner, Textarea } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import { adminPushApi } from '../../services/api';

export function PushNotificationsPage() {
  const [subscriberCount, setSubscriberCount] = useState<number | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [url, setUrl] = useState('');
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    adminPushApi.getStats().then((res) => setSubscriberCount(res.data.subscriberCount));
  }, []);

  const handleSend = async () => {
    if (!title.trim() || !body.trim()) return;
    setSending(true);
    setSent(false);
    try {
      await adminPushApi.sendToAll(title.trim(), body.trim(), url.trim() || undefined);
      setSent(true);
      setTitle('');
      setBody('');
      setUrl('');
      setTimeout(() => setSent(false), 3000);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('push.title')}</h1>
        {sent && <span className="text-success text-sm font-medium">{t('common.sent')}</span>}
      </div>

      <div className="bg-default-100 rounded-xl p-5 flex items-center gap-4">
        <div className="text-4xl font-bold text-primary min-w-8 text-center">
          {subscriberCount === null ? <Spinner size="sm" /> : subscriberCount}
        </div>
        <div className="text-sm text-default-600">
          {subscriberCount === 1
            ? t('push.subscribers_one')
            : t('push.subscribers_other')}
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <h2 className="text-lg font-semibold">{t('push.send_section')}</h2>
        <Input
          label={t('push.label_title')}
          value={title}
          onValueChange={setTitle}
          isRequired
        />
        <Textarea
          label={t('push.label_message')}
          value={body}
          onValueChange={setBody}
          isRequired
          minRows={3}
        />
        <Input
          label={t('push.label_url')}
          value={url}
          onValueChange={setUrl}
          placeholder={t('push.url_placeholder')}
        />
        <Button
          color="primary"
          onPress={handleSend}
          isDisabled={!title.trim() || !body.trim()}
          isLoading={sending}
          className="self-start"
        >
          {t('push.send_btn')}
        </Button>
      </div>
    </div>
  );
}
