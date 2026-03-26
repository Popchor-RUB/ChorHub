import { useEffect, useRef, useState } from 'react';
import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader, Spinner } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import { BrowserQRCodeReader, type IScannerControls } from '@zxing/browser';
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

export function QrScannerModal({ isOpen, onClose, onScanSuccess }: Props) {
  const { t } = useTranslation();
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const readerRef = useRef<BrowserQRCodeReader | null>(null);
  const lastTokenRef = useRef<string | null>(null);
  const hasRecognizedRef = useRef(false);

  const [scannerError, setScannerError] = useState<string | null>(null);
  const [keyLoading, setKeyLoading] = useState(false);
  const [keyError, setKeyError] = useState<string | null>(null);
  const onCloseRef = useRef(onClose);
  const onScanSuccessRef = useRef(onScanSuccess);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    onScanSuccessRef.current = onScanSuccess;
  }, [onScanSuccess]);

  useEffect(() => {
    if (!isOpen) {
      controlsRef.current?.stop();
      controlsRef.current = null;
      readerRef.current = null;
      lastTokenRef.current = null;
      hasRecognizedRef.current = false;
      setScannerError(null);
      setKeyError(null);
      setKeyLoading(false);
      return;
    }

    let closed = false;

    const start = async () => {
      setScannerError(null);
      setKeyError(null);
      setKeyLoading(true);

      try {
        await getCheckinVerificationKey();
      } catch {
        if (!closed) setKeyError(t('checkin.admin_key_error'));
      } finally {
        if (!closed) setKeyLoading(false);
      }

      if (!videoRef.current || closed) return;

      try {
        const reader = new BrowserQRCodeReader(undefined, {
          delayBetweenScanAttempts: 250,
          delayBetweenScanSuccess: 1000,
        });
        readerRef.current = reader;

        const controls = await reader.decodeFromVideoDevice(undefined, videoRef.current, (result) => {
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
        });

        controlsRef.current = controls;
      } catch {
        if (!closed) setScannerError(t('checkin.admin_camera_error'));
      }
    };

    void start();

    return () => {
      closed = true;
      hasRecognizedRef.current = false;
      controlsRef.current?.stop();
      controlsRef.current = null;
      readerRef.current = null;
    };
  }, [isOpen, t]);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl" scrollBehavior="inside">
      <ModalContent>
        <ModalHeader>{t('checkin.admin_modal_title')}</ModalHeader>
        <ModalBody>
          <div className="bg-black rounded-xl overflow-hidden relative min-h-[260px]">
            <video ref={videoRef} className="w-full h-full object-cover" muted playsInline />
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
              void getCheckinVerificationKey(true).catch(() => {
                setKeyError(t('checkin.admin_key_error'));
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
