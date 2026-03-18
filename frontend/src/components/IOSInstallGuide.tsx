import { useEffect } from 'react';
import { Button } from '@heroui/react';
import { useTranslation } from 'react-i18next';

interface Props {
  forced: boolean;
  onDismiss: () => void;
}

// iOS share button icon (box with arrow pointing up)
function ShareIcon({ className }: { className?: string }) {
  return (
    <svg
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={2}
      stroke="currentColor"
      className={className}
      aria-hidden
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5m-13.5-9L12 3m0 0 4.5 4.5M12 3v13.5"
      />
    </svg>
  );
}

function Step({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
        {icon}
      </div>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-default-500 mt-0.5">{desc}</p>
      </div>
    </li>
  );
}

function StepList({ className }: { className?: string }) {
  const { t } = useTranslation();
  const step1Words = t('ios_guide.step1_desc').split(' ');

  return (
    <ol className={`space-y-4 ${className ?? ''}`}>
      <Step
        icon={<ShareIcon className="w-4 h-4 text-primary" />}
        title={t('ios_guide.step1_title')}
        desc={
          <>
            {step1Words.slice(0, -1).join(' ')}{' '}
            <ShareIcon className="w-3.5 h-3.5 inline relative -top-px" />
            {' '}{step1Words.slice(-1)[0]}
          </>
        }
      />
      <Step
        icon={
          <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-primary" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v6m3-3H9m12 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
          </svg>
        }
        title={t('ios_guide.step2_title')}
        desc={t('ios_guide.step2_desc')}
      />
      <Step
        icon={
          <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-primary" aria-hidden>
            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
          </svg>
        }
        title={t('ios_guide.step3_title')}
        desc={t('ios_guide.step3_desc')}
      />
    </ol>
  );
}

function ForcedGuide() {
  const { t } = useTranslation();

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    (document.activeElement as HTMLElement)?.blur();

    const handleFocusIn = (e: FocusEvent) => {
      (e.target as HTMLElement)?.blur();
    };
    document.addEventListener('focusin', handleFocusIn, true);

    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('focusin', handleFocusIn, true);
    };
  }, []);

  return (
    <div className="fixed inset-0 z-[9999] bg-background flex flex-col items-center justify-center p-6 touch-none">
      <div className="flex flex-col items-center gap-3 mb-8">
        <img
          src={`${import.meta.env.BASE_URL}icons/apple-touch-icon.png`}
          alt="ChorHub"
          className="w-20 h-20 rounded-[22%] shadow-lg"
        />
        <h1 className="text-2xl font-bold text-center">{t('ios_guide.install_title')}</h1>
        <p className="text-default-500 text-sm text-center">{t('ios_guide.install_subtitle')}</p>
      </div>

      <div className="w-full max-w-sm">
        <StepList />
      </div>

      {/* Arrow hinting at the Safari toolbar */}
      <div className="absolute bottom-8 flex flex-col items-center gap-1">
        <p className="text-xs text-default-400">{t('ios_guide.share_hint')}</p>
        <svg
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={2.5}
          stroke="currentColor"
          className="w-5 h-5 text-default-400 animate-bounce"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
        </svg>
      </div>
    </div>
  );
}

function DismissableGuide({ onDismiss }: { onDismiss: () => void }) {
  const { t } = useTranslation();

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col justify-end">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onDismiss} />

      {/* Bottom sheet */}
      <div
        className="relative bg-background rounded-t-3xl shadow-2xl"
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
      >
        {/* Handle bar */}
        <div className="pt-3 pb-1 flex justify-center">
          <div className="w-10 h-1 bg-default-300 rounded-full" />
        </div>

        <div className="px-5 pt-3">
          {/* Header row */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-11 h-11 bg-primary rounded-2xl flex items-center justify-center text-white text-lg shadow-sm flex-shrink-0">
              🎵
            </div>
            <div className="flex-1">
              <h2 className="text-base font-bold leading-tight">{t('ios_guide.install_title')}</h2>
              <p className="text-default-500 text-xs">{t('ios_guide.install_subtitle')}</p>
            </div>
            <button
              onClick={onDismiss}
              aria-label={t('common.close')}
              className="w-7 h-7 rounded-full bg-default-100 flex items-center justify-center flex-shrink-0"
            >
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4 text-default-500" aria-hidden>
                <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
              </svg>
            </button>
          </div>

          <div className="h-px bg-divider mb-4" />

          <StepList className="mb-5" />

          <Button variant="flat" fullWidth size="sm" onPress={onDismiss} className="mb-4">
            {t('ios_guide.understood')}
          </Button>

          {/* Arrow hinting at the Safari toolbar */}
          <div className="flex flex-col items-center gap-0.5 pb-1">
            <p className="text-xs text-default-400">{t('ios_guide.share_hint')}</p>
            <svg
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2.5}
              stroke="currentColor"
              className="w-5 h-5 text-default-400 animate-bounce"
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  );
}

export function IOSInstallGuide({ forced, onDismiss }: Props) {
  if (forced) return <ForcedGuide />;
  return <DismissableGuide onDismiss={onDismiss} />;
}
