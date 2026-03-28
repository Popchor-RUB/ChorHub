import { useEffect, useState } from 'react';
import { Button, Modal, ModalBody, ModalContent } from '@heroui/react';
import { useTranslation } from 'react-i18next';

interface Props {
  forced: boolean;
  onDismiss: () => void;
}

function getIOSMajorVersion(): number | null {
  if (typeof navigator === 'undefined') return null;
  const ua = navigator.userAgent;

  // Safari on iOS 26+ freezes "iPhone OS" at 18.x.
  // The changing part is "Version/<major>": e.g. Version/26.0.
  const safariVersionMatch = ua.match(/Version\/(\d+)(?:\.\d+)?[^)]*Safari\//i);
  if (safariVersionMatch) return Number.parseInt(safariVersionMatch[1], 10);

  // Fallback for non-Safari iOS browsers.
  const osMatch = ua.match(/(?:CPU (?:iPhone )?OS|iPhone OS|CPU OS)\s+(\d+)(?:[._]\d+)?/i);
  if (osMatch) return Number.parseInt(osMatch[1], 10);

  return null;
}

function isIOS26OrAbove(): boolean {
  const major = getIOSMajorVersion();
  return major !== null && major >= 26;
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

function TutorialVideoModal({ open, src, onClose }: { open: boolean; src: string; onClose: () => void }) {
  return (
    <Modal
      isOpen={open}
      onClose={onClose}
      size="full"
      classNames={{ wrapper: 'z-[10010]' }}
    >
      <ModalContent>
        <ModalBody className="pt-[calc(env(safe-area-inset-top)+3rem)] pb-[calc(env(safe-area-inset-bottom)+1rem)]">
          <div className="h-full flex items-center justify-center">
            <video
              className="w-full h-auto max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-5.5rem)] bg-black rounded-xl"
              controls
              autoPlay
              playsInline
              preload="metadata"
              src={src}
            />
          </div>
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}

function StepList({ className }: { className?: string }) {
  const { t } = useTranslation();
  const ios26 = isIOS26OrAbove();
  const step1Words = t(ios26 ? 'ios_guide.step26_2_desc' : 'ios_guide.step1_desc').split(' ');
  const tutorialUrl = ios26
    ? `${import.meta.env.BASE_URL}videos/ios-pwa-setup.mp4`
    : `${import.meta.env.BASE_URL}videos/ios-pwa-setup-ios18.mp4`;
  const [videoOpen, setVideoOpen] = useState(false);

  return (
    <>
      <ol className={`space-y-4 ${className ?? ''}`}>
        {ios26 && (
          <Step
            icon={
              <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-primary" aria-hidden>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm6 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm6 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
              </svg>
            }
            title={t('ios_guide.step26_1_title')}
            desc={t('ios_guide.step26_1_desc')}
          />
        )}
        <Step
          icon={<ShareIcon className="w-4 h-4 text-primary" />}
          title={t(ios26 ? 'ios_guide.step26_2_title' : 'ios_guide.step1_title')}
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
        <li aria-hidden className="border-t border-divider pt-1 mt-1" />
        <Step
          icon={
            <svg fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 text-primary" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 9a3.75 3.75 0 1 1 7.02 1.875c-.66 1.292-2.024 1.84-2.977 2.625-.575.473-1.043 1.05-1.043 2.25m.01 3h.008v.008h-.008v-.008Z" />
            </svg>
          }
          title={t('ios_guide.step4_title')}
          desc={(
            <button
              type="button"
              onClick={() => setVideoOpen(true)}
              className="underline underline-offset-2 text-primary"
            >
              {t('ios_guide.step4_link')}
            </button>
          )}
        />
      </ol>
      <TutorialVideoModal open={videoOpen} src={tutorialUrl} onClose={() => setVideoOpen(false)} />
    </>
  );
}

function ToolbarHint({ inSheet = false }: { inSheet?: boolean }) {
  const { t } = useTranslation();
  const ios26 = isIOS26OrAbove();
  const wrapperClasses = inSheet
    ? ios26
      ? 'flex flex-col items-end gap-1'
      : 'flex flex-col items-center gap-1'
    : ios26
      ? 'absolute right-[50px] bottom-[calc(env(safe-area-inset-bottom))] flex flex-col items-end gap-1'
      : 'absolute left-1/2 -translate-x-1/2 bottom-[calc(env(safe-area-inset-bottom)+2px)] flex flex-col items-center gap-1';
  const arrowPath = 'm19.5 8.25-7.5 7.5-7.5-7.5';

  return (
    <div className={wrapperClasses}>
      <p className="text-xs text-default-400">{t(ios26 ? 'ios_guide.menu_hint' : 'ios_guide.share_hint')}</p>
      <svg
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={2.5}
        stroke="currentColor"
        className="w-5 h-5 text-default-400 animate-bounce"
        aria-hidden
      >
        <path strokeLinecap="round" strokeLinejoin="round" d={arrowPath} />
      </svg>
    </div>
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
    <div className="fixed inset-0 z-[9999] bg-background flex flex-col items-center justify-start p-6 pt-[calc(env(safe-area-inset-top)+1.25rem)] touch-none">
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

      <ToolbarHint />
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

          <div className="-mb-2 flex justify-center">
            <ToolbarHint inSheet />
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
