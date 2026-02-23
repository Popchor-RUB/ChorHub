import { useEffect, useState } from 'react';
import { Checkbox, Spinner } from '@heroui/react';
import { generalInfoApi } from '../../services/api';
import { MarkdownEditor } from '../../components/info/MarkdownEditor';

export function GeneralInfoPage() {
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [sendPush, setSendPush] = useState(false);

  useEffect(() => {
    generalInfoApi.get().then((res) => {
      setContent(res.data.markdownContent ?? '');
      setLoading(false);
    });
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await generalInfoApi.update(content, sendPush);
      setSaved(true);
      setSendPush(false);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center pt-8"><Spinner /></div>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Allgemeine Informationen</h1>
        {saved && <span className="text-success text-sm font-medium">Gespeichert ✓</span>}
      </div>
      <p className="text-sm text-default-500">
        Diese Informationen werden allen Mitgliedern auf der Startseite angezeigt.
      </p>
      <MarkdownEditor
        value={content}
        onChange={setContent}
        onSave={handleSave}
        saving={saving}
      />
      <Checkbox isSelected={sendPush} onValueChange={setSendPush}>
        Push-Benachrichtigung an alle Mitglieder senden
      </Checkbox>
    </div>
  );
}
