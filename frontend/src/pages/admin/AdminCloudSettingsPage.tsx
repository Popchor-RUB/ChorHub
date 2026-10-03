import { useCallback, useEffect, useState } from 'react';
import { Button, FieldError, Input, Label, Spinner, TextField } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import { settingsApi } from '../../services/api';

function isAllowedCloudUrl(value: string): boolean {
  if (!/^https?:\/\//i.test(value) || value.includes('\\')) return false;
  try {
    const url = new URL(value);
    return (url.protocol === 'http:' || url.protocol === 'https:')
      && url.hostname.length > 0
      && !url.username
      && !url.password;
  } catch {
    return false;
  }
}

export function AdminCloudSettingsPage() {
  const { t } = useTranslation();
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);
  const [saved, setSaved] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const response = await settingsApi.get('cloud.url');
      setValue(response.data.value ?? '');
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const trimmedValue = value.trim();
  const invalidUrl = submitted && trimmedValue.length > 0 && !isAllowedCloudUrl(trimmedValue);

  const handleSave = async () => {
    setSubmitted(true);
    setSaved(false);
    setSaveError(false);
    if (trimmedValue && !isAllowedCloudUrl(trimmedValue)) return;

    setSaving(true);
    try {
      if (trimmedValue) {
        await settingsApi.set('cloud.url', trimmedValue);
      } else {
        await settingsApi.delete('cloud.url');
      }
      setValue(trimmedValue);
      setSaved(true);
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="flex max-w-2xl flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold">{t('cloud.admin_title')}</h1>
        <p className="mt-1 text-sm text-muted">{t('cloud.admin_description')}</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-8" role="status"><Spinner aria-label={t('cloud.loading')} /></div>
      ) : loadError ? (
        <div className="flex flex-col items-start gap-3">
          <p role="alert" className="text-sm text-danger">{t('cloud.settings_load_error')}</p>
          <Button variant="secondary" onPress={() => void loadSettings()}>{t('cloud.retry')}</Button>
        </div>
      ) : (
        <div className="flex flex-col items-start gap-3">
          <TextField
            className="w-full"
            type="url"
            isDisabled={saving}
            value={value}
            onChange={(nextValue) => {
              setValue(nextValue);
              setSaved(false);
              setSaveError(false);
            }}
            isInvalid={invalidUrl}
          >
            <Label>{t('cloud.url_label')}</Label>
            <Input
              id="cloud-url-input"
              data-testid="cloud-url-input"
              placeholder={t('cloud.url_placeholder')}
              autoComplete="url"
            />
            {invalidUrl && <FieldError>{t('cloud.url_invalid')}</FieldError>}
          </TextField>

          <p className="text-xs text-muted">{t('cloud.url_help')}</p>

          {saveError && <p role="alert" className="text-sm text-danger">{t('cloud.save_error')}</p>}
          {saved && <p id="cloud-settings-saved" data-testid="cloud-settings-saved" role="status" className="text-sm text-success">{t('cloud.saved')}</p>}

          <Button
            id="cloud-settings-save"
            data-testid="cloud-settings-save"
            onPress={() => void handleSave()}
            isPending={saving}
            isDisabled={saving}
          >
            {({ isPending }) => <>{isPending && <Spinner color="current" size="sm" />}{t('cloud.save')}</>}
          </Button>
        </div>
      )}
    </section>
  );
}
