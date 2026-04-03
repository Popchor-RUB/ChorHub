import { useEffect, useRef, useState } from 'react';
import { ArrowsRightLeftIcon } from '@heroicons/react/24/outline';
import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Spinner } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import type { CheckinPayload } from '../../types';
import { getCheckinVerificationKey } from '../../services/checkinPublicKey';
import { verifyCheckinToken } from '../../utils/checkinToken';

export type QrScanResult = {
  payload: CheckinPayload;
  signatureValid: boolean;
  scannedAtIso: string;
};

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (result: QrScanResult) => void;
};

const CAMERA_DEVICE_STORAGE_KEY = 'chorhub:qr-scanner-camera-device-id';

export function QrScannerModal({ isOpen, onClose, onScanSuccess }: Props) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const lastTokenRef = useRef<string | null>(null);
  const hasRecognizedRef = useRef(false);

  const [scannerError, setScannerError] = useState<string | null>(null);
  const [keyLoading, setKeyLoading] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [availableCameraIds, setAvailableCameraIds] = useState<string[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string | null>(null);
  const onCloseRef = useRef(onClose);
  const onScanSuccessRef = useRef(onScanSuccess);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    onScanSuccessRef.current = onScanSuccess;
  }, [onScanSuccess]);

  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return;

    const onE2eScan = (event: Event) => {
      const customEvent = event as CustomEvent<QrScanResult>;
      const detail = customEvent.detail;
      if (!detail?.payload?.memberId) return;
      hasRecognizedRef.current = true;
      controlsRef.current?.stop();
      onCloseRef.current();
      onScanSuccessRef.current(detail);
    };

    window.addEventListener('chorhub:e2e-qr-scan', onE2eScan as EventListener);
    return () => {
      window.removeEventListener('chorhub:e2e-qr-scan', onE2eScan as EventListener);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      controlsRef.current?.stop();
      controlsRef.current = null;
      lastTokenRef.current = null;
      hasRecognizedRef.current = false;
      setScannerError(null);
      setKeyError(null);
      setKeyLoading(false);
      setAvailableCameraIds([]);
      return;
    }

    let closed = false;
    let refreshTimeout: ReturnType<typeof window.setTimeout> | null = null;

    const describeError = (error: unknown): string => {
      if (error instanceof Error && error.message) return error.message;
      return String(error);
    };

    const start = async () => {
      setScannerError(null);
      setKeyError(null);
      setKeyLoading(true);

      try {
        await getCheckinVerificationKey();
      } catch (error) {
        if (!closed) setKeyError(`${t('checkin.admin_key_error')} (${describeError(error)})`);
      } finally {
        if (!closed) setKeyLoading(false);
      }

      if (!videoRef.current || closed) return;

      try {
        if (!window.isSecureContext) {
          throw new Error('Secure context required (HTTPS or localhost)');
        }
        if (!navigator.mediaDevices?.getUserMedia) {
          throw new Error('Camera API is not available in this browser');
        }

        const { BrowserQRCodeReader } = await import('@zxing/browser');
        const reader = new BrowserQRCodeReader(undefined, {
          delayBetweenScanAttempts: 250,
          delayBetweenScanSuccess: 1000,
        });

        const refreshAvailableCameras = async () => {
          const devices = await navigator.mediaDevices.enumerateDevices();
          if (!closed) {
            setAvailableCameraIds(
              devices
                .filter((device) => device.kind === 'videoinput')
                .map((device) => device.deviceId),
            );
          }
        };

        const onDecode = (result: Parameters<Parameters<typeof reader.decodeFromVideoDevice>[2]>[0]) => {
          if (!result) return;
          if (hasRecognizedRef.current) return;
          const text = result.getText();
          if (!text || text === lastTokenRef.current) return;
          lastTokenRef.current = text;

          void (async () => {
            try {
              const verificationKey = await getCheckinVerificationKey();
              const verified = await verifyCheckinToken(text, verificationKey);
              if (!closed) {
                hasRecognizedRef.current = true;
                setScannerError(null);
                const scanResult: QrScanResult = {
                  payload: verified.payload,
                  signatureValid: verified.signatureValid,
                  scannedAtIso: new Date().toISOString(),
                };
                controlsRef.current?.stop();
                onCloseRef.current();
                onScanSuccessRef.current(scanResult);
              }
            } catch {
              if (!closed) {
                setScannerError(t('checkin.admin_parse_error'));
              }
            }
          })();
        };

        let controls: { stop: () => void };
        try {
          controls = await reader.decodeFromVideoDevice(selectedCameraId ?? undefined, videoRef.current, onDecode);
        } catch (error) {
          if (!selectedCameraId) throw error;
          controls = await reader.decodeFromVideoDevice(undefined, videoRef.current, onDecode);
        }

        controlsRef.current = controls;
        await refreshAvailableCameras();
        refreshTimeout = window.setTimeout(() => {
          void refreshAvailableCameras();
        }, 500);
      } catch (error) {
        if (!closed) setScannerError(`${t('checkin.admin_camera_error')} (${describeError(error)})`);
      }
    };

    void start();

    return () => {
      closed = true;
      if (refreshTimeout) window.clearTimeout(refreshTimeout);
      hasRecognizedRef.current = false;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [isOpen, selectedCameraId, t]);

  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return;
    const storedCameraId = window.localStorage.getItem(CAMERA_DEVICE_STORAGE_KEY);
    setSelectedCameraId(storedCameraId || null);
  }, [isOpen]);

  const onSwitchCamera = () => {
    if (availableCameraIds.length === 0) return;

    setSelectedCameraId((currentId) => {
      const currentIndex = currentId ? availableCameraIds.indexOf(currentId) : -1;
      const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % availableCameraIds.length : 0;
      const nextCameraId = availableCameraIds[nextIndex] ?? null;
      if (nextCameraId && typeof window !== 'undefined') {
        window.localStorage.setItem(CAMERA_DEVICE_STORAGE_KEY, nextCameraId);
      }
      return nextCameraId;
    });
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl" scrollBehavior="inside">
      <ModalContent data-testid="qr-scanner-modal">
        <ModalHeader>{t('checkin.admin_modal_title')}</ModalHeader>
        <ModalBody>
          <div className="bg-black rounded-xl overflow-hidden relative min-h-[260px]">
            <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
            {availableCameraIds.length > 1 && (
              <Button
                variant="flat"
                isIconOnly
                size="sm"
                className="absolute bottom-3 right-3 z-10 bg-black/65 text-white"
                aria-label={t('checkin.admin_switch_camera')}
                onPress={onSwitchCamera}
              >
                <ArrowsRightLeftIcon className="w-4 h-4" />
              </Button>
            )}
            {keyLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                <Spinner color="white" />
              </div>
            )}
          </div>
          {keyError && <p className="text-danger text-sm">{keyError}</p>}
          {scannerError && <p className="text-danger text-sm">{scannerError}</p>}
          {!scannerError && !keyError && <p className="text-default-500 text-sm">{t('checkin.admin_waiting')}</p>}
        </ModalBody>
        <ModalFooter>
          <Button
            variant="flat"
            onPress={() => {
              setKeyError(null);
              setScannerError(null);
              void getCheckinVerificationKey(true).catch((error: unknown) => {
                const detail = error instanceof Error ? error.message : String(error);
                setKeyError(`${t('checkin.admin_key_error')} (${detail})`);
              });
            }}
          >
            {t('checkin.admin_reload_key')}
          </Button>
          <Button color="primary" onPress={onClose}>
            {t('common.close')}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
