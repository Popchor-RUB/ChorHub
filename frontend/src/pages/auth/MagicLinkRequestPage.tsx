import { useState } from 'react';
import { Card, CardBody, CardHeader, Input, Button } from '@heroui/react';
import { memberAuthApi } from '../../services/api';

export function MagicLinkRequestPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await memberAuthApi.requestMagicLink(email);
      setSent(true);
    } catch {
      setError('Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-default-50">
      <Card className="w-full max-w-md">
        <CardHeader className="flex flex-col items-start gap-1 pb-0">
          <h1 className="text-2xl font-bold">ChorHub</h1>
          <p className="text-default-500">Mitglieder-Anmeldung</p>
        </CardHeader>
        <CardBody>
          {sent ? (
            <div className="text-center py-4">
              <p className="text-success font-medium mb-2">E-Mail versendet!</p>
              <p className="text-default-600 text-sm">
                Falls Ihre E-Mail-Adresse bekannt ist, erhalten Sie in Kürze einen Anmeldelink.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <p className="text-default-600 text-sm">
                Geben Sie Ihre E-Mail-Adresse ein. Sie erhalten einen persönlichen Anmeldelink.
              </p>
              <Input
                type="email"
                label="E-Mail-Adresse"
                value={email}
                onValueChange={setEmail}
                isRequired
                placeholder="ihre@email.de"
              />
              {error && <p className="text-danger text-sm">{error}</p>}
              <Button type="submit" color="primary" isLoading={loading} fullWidth>
                Anmeldelink anfordern
              </Button>
            </form>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
