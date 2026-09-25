import { useEffect, useState } from 'react';
import { Button, Modal, Spinner } from '@heroui/react';
import { QrCodeIcon, XMarkIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import type { QrScanResult } from './QrScannerModal';

type Props = {
  isOpen: boolean;
  scanResult: QrScanResult | null;
  memberEmail: string;
  relativeIssuedAt: string;
  lastAttendedText: string;
  lastAttendedRehearsalsAgo: number | null;
  attendancePlanText: string;
  attendancePlanMissing: boolean;
  unexcusedAbsenceCount: number | null;
  scannedMemberAttended: boolean;
  scanRecordSaving: boolean;
  scanRecordError: string | null;
  memberInfoFetchError: boolean;
  canOpenMemberDetail: boolean;
  onClose: () => void;
  onRecordAttendance: () => void;
  onScanNext: () => void;
  onOpenMemberDetail: () => void;
};

export function QrScanResultModal({
  isOpen,
  scanResult,
  memberEmail,
  relativeIssuedAt,
  lastAttendedText,
  lastAttendedRehearsalsAgo,
  attendancePlanText,
  attendancePlanMissing,
  unexcusedAbsenceCount,
  scannedMemberAttended,
  scanRecordSaving,
  scanRecordError,
  memberInfoFetchError,
  canOpenMemberDetail,
  onClose,
  onRecordAttendance,
  onScanNext,
  onOpenMemberDetail,
}: Props) {
  const { t } = useTranslation();
  const [currentTime, setCurrentTime] = useState<number | null>(null);

  useEffect(() => {
    if (!scanResult) return;
    const timer = window.setTimeout(() => setCurrentTime(Date.now()), 0);
    return () => window.clearTimeout(timer);
  }, [scanResult]);

  const isOlderThanFiveMinutes = scanResult && currentTime !== null
    ? currentTime - new Date(scanResult.payload.issuedAt).getTime() > 5 * 60 * 1000
    : false;
  const lastAttendedClassName = lastAttendedRehearsalsAgo === null || lastAttendedRehearsalsAgo >= 4
    ? 'font-medium text-danger'
    : lastAttendedRehearsalsAgo >= 2
      ? 'font-medium text-warning'
      : 'font-medium';

  return (
    <Modal.Backdrop isOpen={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Modal.Container size="lg">
        <Modal.Dialog data-testid="qr-scan-result-modal">
          <Modal.CloseTrigger />
          <Modal.Header><Modal.Heading>{t('checkin.admin_result_title')}</Modal.Heading></Modal.Header>
          <Modal.Body>
          {!scanResult ? (
            <p className="text-muted text-sm">{t('checkin.admin_waiting')}</p>
          ) : memberInfoFetchError ? (
            <p className="text-danger font-medium">{t('checkin.admin_member_info_fetch_error')}</p>
          ) : (
            <div className="space-y-2 text-sm">
              <p>
                <span className="text-muted text-base">{t('checkin.admin_name')}:</span>{' '}
                <span
                  role={canOpenMemberDetail ? 'button' : undefined}
                  tabIndex={canOpenMemberDetail ? 0 : undefined}
                  className={canOpenMemberDetail
                    ? 'font-semibold text-3xl leading-tight cursor-pointer underline decoration-dotted underline-offset-4 hover:text-accent transition-colors'
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
                <span className="text-muted">{t('checkin.admin_email')}:</span>{' '}
                <span className="font-medium">{memberEmail}</span>
              </p>
              <p>
                <span className="text-muted">{t('checkin.admin_last_attended')}:</span>{' '}
                <span className={lastAttendedClassName}>{lastAttendedText}</span>
              </p>
              <p>
                <span className="text-muted">{t('checkin.admin_plan')}:</span>{' '}
                <span className={attendancePlanMissing ? 'font-medium text-danger' : 'font-medium'}>
                  {attendancePlanText}
                </span>
              </p>
              <p>
                <span className="text-muted">{t('checkin.admin_created')}:</span>{' '}
                <span className={isOlderThanFiveMinutes ? 'font-medium text-danger' : 'font-medium'}>
                  {relativeIssuedAt}
                </span>
              </p>
              <p>
                <span className="text-muted">{t('checkin.admin_signature')}:</span>{' '}
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
          </Modal.Body>
          <Modal.Footer>
          <Button
            variant={scannedMemberAttended ? 'primary' : 'secondary'}
            isPending={scanRecordSaving}
            isDisabled={!scanResult?.signatureValid || !scanResult || memberInfoFetchError}
            onPress={onRecordAttendance}
          >
            {({ isPending }) => <>{isPending && <Spinner color="current" size="sm" />}{scannedMemberAttended ? t('attendance.btn_present') : t('attendance.btn_record')}</>}
          </Button>
          <Button
            variant="tertiary"
            isIconOnly
            aria-label={t('checkin.admin_scan_next')}
            onPress={onScanNext}
          >
            <QrCodeIcon className="w-5 h-5" />
          </Button>
          <Button
            variant="tertiary"
            isIconOnly
            aria-label={t('checkin.admin_close_result')}
            onPress={onClose}
          >
            <XMarkIcon className="w-5 h-5" />
          </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
