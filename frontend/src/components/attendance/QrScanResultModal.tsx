import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from '@heroui/react';
import { QrCodeIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import type { QrScanResult } from './QrScannerModal';

type Props = {
  isOpen: boolean;
  scanResult: QrScanResult | null;
  relativeIssuedAt: string;
  lastAttendedText: string;
  lastAttendedRehearsalsAgo: number | null;
  attendancePlanText: string;
  attendancePlanMissing: boolean;
  unexcusedAbsenceCount: number | null;
  scannedMemberAttended: boolean;
  scanRecordSaving: boolean;
  scanRecordError: string | null;
  canOpenMemberDetail: boolean;
  onClose: () => void;
  onRecordAttendance: () => void;
  onScanNext: () => void;
  onOpenMemberDetail: () => void;
};

export function QrScanResultModal({
  isOpen,
  scanResult,
  relativeIssuedAt,
  lastAttendedText,
  lastAttendedRehearsalsAgo,
  attendancePlanText,
  attendancePlanMissing,
  unexcusedAbsenceCount,
  scannedMemberAttended,
  scanRecordSaving,
  scanRecordError,
  canOpenMemberDetail,
  onClose,
  onRecordAttendance,
  onScanNext,
  onOpenMemberDetail,
}: Props) {
  const { t } = useTranslation();
  const isOlderThanFiveMinutes = scanResult
    ? Date.now() - new Date(scanResult.payload.issuedAt).getTime() > 5 * 60 * 1000
    : false;
  const lastAttendedClassName = lastAttendedRehearsalsAgo === null || lastAttendedRehearsalsAgo >= 4
    ? 'font-medium text-danger'
    : lastAttendedRehearsalsAgo >= 2
      ? 'font-medium text-warning'
      : 'font-medium';

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl">
      <ModalContent data-testid="qr-scan-result-modal">
        <ModalHeader>{t('checkin.admin_result_title')}</ModalHeader>
        <ModalBody>
          {!scanResult ? (
            <p className="text-default-500 text-sm">{t('checkin.admin_waiting')}</p>
          ) : (
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-default-500 text-base">{t('checkin.admin_name')}:</span>{' '}
                <span
                  role={canOpenMemberDetail ? 'button' : undefined}
                  tabIndex={canOpenMemberDetail ? 0 : undefined}
                  className={canOpenMemberDetail
                    ? 'font-semibold text-3xl leading-tight cursor-pointer underline decoration-dotted underline-offset-4 hover:text-primary transition-colors'
                    : 'font-semibold text-3xl leading-tight'}
                  onClick={canOpenMemberDetail ? onOpenMemberDetail : undefined}
                  onKeyDown={canOpenMemberDetail ? (e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onOpenMemberDetail();
                    }
                  } : undefined}
                >
                  {scanResult.payload.name}
                </span>
              </p>
              <p>
                <span className="text-default-500">{t('checkin.admin_email')}:</span>{' '}
                <span className="font-medium">{scanResult.payload.email}</span>
              </p>
              <p>
                <span className="text-default-500">{t('checkin.admin_last_attended')}:</span>{' '}
                <span className={lastAttendedClassName}>{lastAttendedText}</span>
              </p>
              <p>
                <span className="text-default-500">{t('checkin.admin_plan')}:</span>{' '}
                <span className={attendancePlanMissing ? 'font-medium text-danger' : 'font-medium'}>
                  {attendancePlanText}
                </span>
              </p>
              <p>
                <span className="text-default-500">{t('checkin.admin_created')}:</span>{' '}
                <span className={isOlderThanFiveMinutes ? 'font-medium text-danger' : 'font-medium'}>
                  {relativeIssuedAt}
                </span>
              </p>
              <p>
                <span className="text-default-500">{t('checkin.admin_signature')}:</span>{' '}
                <span className={scanResult.signatureValid ? 'text-success font-semibold' : 'text-danger font-semibold'}>
                  {scanResult.signatureValid ? t('checkin.admin_signature_valid') : t('checkin.admin_signature_invalid')}
                </span>
              </p>
              {typeof unexcusedAbsenceCount === 'number' && unexcusedAbsenceCount > 3 && (
                <p className="text-danger font-medium">
                  {t('checkin.admin_unexcused_warning', { count: unexcusedAbsenceCount })}
                </p>
              )}
              {scanRecordError && <p className="text-danger">{scanRecordError}</p>}
              {!scanResult.signatureValid && (
                <p className="text-warning text-sm">{t('checkin.admin_signature_invalid_hint')}</p>
              )}
            </div>
          )}
        </ModalBody>
        <ModalFooter>
          <Button
            color={scannedMemberAttended ? 'success' : 'default'}
            variant={scannedMemberAttended ? 'solid' : 'bordered'}
            isLoading={scanRecordSaving}
            isDisabled={!scanResult?.signatureValid || !scanResult}
            onPress={onRecordAttendance}
          >
            {scannedMemberAttended ? t('attendance.btn_present') : t('attendance.btn_record')}
          </Button>
          <Button
            variant="flat"
            isIconOnly
            aria-label={t('checkin.admin_scan_next')}
            onPress={onScanNext}
          >
            <QrCodeIcon className="w-5 h-5" />
          </Button>
          <Button
            variant="flat"
            isIconOnly
            aria-label={t('checkin.admin_close_result')}
            onPress={onClose}
          >
            <XMarkIcon className="w-5 h-5" />
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
