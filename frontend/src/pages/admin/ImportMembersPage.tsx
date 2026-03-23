import { useState, useEffect } from 'react';
import { Card, CardBody, Button, Checkbox, Chip } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import { adminMembersApi, choirVoicesApi } from '../../services/api';
import { useNavigate } from 'react-router-dom';
import type { ChoirVoice } from '../../types';

interface ImportResult {
  created: number;
  updated: number;
  failed: { email: string; reason: string }[];
}

export function ImportMembersPage() {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState('');
  const [sendEmails, setSendEmails] = useState(false);
  const [voices, setVoices] = useState<ChoirVoice[]>([]);

  useEffect(() => {
    choirVoicesApi.list().then((res) => setVoices(res.data as ChoirVoice[])).catch(() => {});
  }, []);
  const navigate = useNavigate();
  const { t } = useTranslation();

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) setFile(f);
  };

  const handleImport = async () => {
    if (!file) return;
    setLoading(true);
    setError('');
    try {
      const res = await adminMembersApi.import(file, sendEmails);
      setResult(res.data as ImportResult);
    } catch (e: any) {
      setError(e.response?.data?.error?.message ?? t('members.import_failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">{t('members.import_title')}</h1>

      <Card>
        <CardBody className="gap-4">
          <p className="text-sm text-default-600">
            {t('members.import_description')}{' '}
            <code className="bg-default-100 px-1 rounded">firstName, lastName, email, choirVoice</code>
          </p>
          {voices.length > 0 && (
            <p className="text-xs text-default-400">
              {t('members.import_valid_voices')}{' '}
              {voices.map((v) => v.name).join(', ')}
            </p>
          )}

          <div
            className="border-2 border-dashed border-default-300 rounded-xl p-8 text-center cursor-pointer hover:border-primary transition-colors"
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => document.getElementById('csv-input')?.click()}
          >
            {file ? (
              <div>
                <p className="font-medium">{file.name}</p>
                <p className="text-sm text-default-500">{(file.size / 1024).toFixed(1)} KB</p>
              </div>
            ) : (
              <p className="text-default-400">{t('members.import_drop')}</p>
            )}
            <input
              id="csv-input"
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {error && <p className="text-danger text-sm">{error}</p>}

          <Checkbox isSelected={sendEmails} onValueChange={setSendEmails}>
            {t('members.import_send_emails')}
          </Checkbox>

          <div className="flex gap-2">
            <Button color="primary" onPress={handleImport} isLoading={loading} isDisabled={!file}>
              {t('members.import_btn')}
            </Button>
            <Button variant="flat" onPress={() => navigate('/admin/mitglieder')}>
              {t('common.back')}
            </Button>
          </div>
        </CardBody>
      </Card>

      {result && (
        <Card>
          <CardBody className="gap-3">
            <h2 className="font-semibold">{t('members.import_result_title')}</h2>
            <div className="flex gap-2 flex-wrap">
              <Chip color="success" variant="flat">{t('members.import_created', { count: result.created })}</Chip>
              <Chip color="primary" variant="flat">{t('members.import_updated', { count: result.updated })}</Chip>
              {result.failed.length > 0 && (
                <Chip color="danger" variant="flat">{t('members.import_failed_count', { count: result.failed.length })}</Chip>
              )}
            </div>
            {result.failed.length > 0 && (
              <div className="mt-2">
                <p className="text-sm font-medium text-danger mb-1">{t('members.import_errors_title')}</p>
                <ul className="text-sm text-default-600 space-y-1">
                  {result.failed.map((f, i) => (
                    <li key={i}>
                      <span className="font-mono">{f.email}</span>: {f.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
