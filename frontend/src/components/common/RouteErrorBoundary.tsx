import { useMemo, useState } from 'react';
import { isRouteErrorResponse, useRouteError } from 'react-router-dom';
import { Button, Card, CardBody, CardHeader, Divider } from '@heroui/react';
import { useAuthStore } from '../../store/authStore';

type NormalizedError = {
  title: string;
  message: string;
  stack?: string;
};

function normalizeError(error: unknown): NormalizedError {
  if (isRouteErrorResponse(error)) {
    const dataMessage = typeof error.data === 'string'
      ? error.data
      : (error.data as { message?: string } | null)?.message;
    return {
      title: `Route Error (${error.status})`,
      message: dataMessage ?? error.statusText ?? 'Unknown route error',
    };
  }

  if (error instanceof Error) {
    return {
      title: error.name || 'Error',
      message: error.message || 'Unknown error',
      stack: error.stack,
    };
  }

  return {
    title: 'Unknown Error',
    message: typeof error === 'string' ? error : JSON.stringify(error),
  };
}

export function RouteErrorBoundary() {
  const routeError = useRouteError();
  const { memberSession, adminSession } = useAuthStore();
  const [copied, setCopied] = useState(false);
  const error = useMemo(() => normalizeError(routeError), [routeError]);

  const diagnostics = useMemo(() => {
    const lines = [
      `Timestamp: ${new Date().toISOString()}`,
      `URL: ${window.location.href}`,
      `User Agent: ${navigator.userAgent}`,
      `Language: ${navigator.language}`,
      `Member Session: ${memberSession ? 'present' : 'missing'}`,
      `Admin Session: ${adminSession ? 'present' : 'missing'}`,
      `Error: ${error.title}: ${error.message}`,
    ];

    if (error.stack) {
      lines.push('', 'Stack:', error.stack);
    }

    return lines.join('\n');
  }, [adminSession, error.message, error.stack, error.title, memberSession]);

  const copyDiagnostics = async () => {
    try {
      await navigator.clipboard.writeText(diagnostics);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="min-h-[60vh] flex items-center justify-center py-8">
      <Card className="w-full max-w-3xl">
        <CardHeader className="flex flex-col items-start gap-1">
          <h1 className="text-xl font-semibold">Unerwarteter Anwendungsfehler</h1>
          <p className="text-sm text-default-600">
            Beim Laden oder Aktualisieren der Seite ist ein Fehler aufgetreten.
          </p>
        </CardHeader>
        <Divider />
        <CardBody className="flex flex-col gap-4">
          <div className="rounded-lg bg-danger-50 border border-danger-200 p-3">
            <p className="text-sm font-semibold text-danger-700">{error.title}</p>
            <p className="text-sm text-danger-700/90">{error.message}</p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button color="primary" onPress={() => window.location.reload()}>
              Seite neu laden
            </Button>
            <Button variant="flat" onPress={copyDiagnostics}>
              {copied ? 'Fehlerdetails kopiert' : 'Fehlerdetails kopieren'}
            </Button>
          </div>

          <details className="rounded-lg border border-default-200 bg-default-50 p-3">
            <summary className="cursor-pointer text-sm font-medium">
              Technische Details anzeigen
            </summary>
            <pre className="mt-3 whitespace-pre-wrap break-words text-xs text-default-700">
              {diagnostics}
            </pre>
          </details>
        </CardBody>
      </Card>
    </div>
  );
}
