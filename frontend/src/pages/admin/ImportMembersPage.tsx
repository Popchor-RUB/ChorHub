import { useState } from 'react';
import { Card, CardBody, Button, Chip } from '@heroui/react';
import { adminMembersApi } from '../../services/api';
import { useNavigate } from 'react-router-dom';

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
  const navigate = useNavigate();

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
      const res = await adminMembersApi.import(file);
      setResult(res.data as ImportResult);
    } catch (e: any) {
      setError(e.response?.data?.error?.message ?? 'Import fehlgeschlagen.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Mitglieder importieren</h1>

      <Card>
        <CardBody className="gap-4">
          <p className="text-sm text-default-600">
            Laden Sie eine CSV-Datei hoch mit den Spalten:{' '}
            <code className="bg-default-100 px-1 rounded">firstName, lastName, email, choirVoice</code>
          </p>
          <p className="text-xs text-default-400">
            Gültige Stimmlagen: SOPRAN, MEZZOSOPRAN, ALT, TENOR, BARITON, BASS
          </p>

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
              <p className="text-default-400">CSV-Datei hier ablegen oder klicken zum Auswählen</p>
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

          <div className="flex gap-2">
            <Button color="primary" onPress={handleImport} isLoading={loading} isDisabled={!file}>
              Importieren & E-Mails versenden
            </Button>
            <Button variant="flat" onPress={() => navigate('/admin/mitglieder')}>
              Zurück
            </Button>
          </div>
        </CardBody>
      </Card>

      {result && (
        <Card>
          <CardBody className="gap-3">
            <h2 className="font-semibold">Import-Ergebnis</h2>
            <div className="flex gap-2 flex-wrap">
              <Chip color="success" variant="flat">{result.created} neu erstellt</Chip>
              <Chip color="primary" variant="flat">{result.updated} aktualisiert</Chip>
              {result.failed.length > 0 && (
                <Chip color="danger" variant="flat">{result.failed.length} fehlerhaft</Chip>
              )}
            </div>
            {result.failed.length > 0 && (
              <div className="mt-2">
                <p className="text-sm font-medium text-danger mb-1">Fehler:</p>
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
