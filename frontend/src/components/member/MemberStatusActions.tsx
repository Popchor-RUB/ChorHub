import { useEffect, useState } from 'react';
import { Button, Checkbox, Label, Modal, Spinner, TextArea, TextField } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import { adminMembersApi } from '../../services/api';

export interface MemberStatus {
  isDisabled: boolean;
  disabledAt: string | null;
  disableReason: string | null;
}

interface Props {
  memberId: string;
  status: MemberStatus;
  onUpdated: (status: MemberStatus) => void;
}

export function MemberStatusActions({ memberId, status, onUpdated }: Props) {
  const { t } = useTranslation();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [notifyMember, setNotifyMember] = useState(true);
  const [includeReasonInEmail, setIncludeReasonInEmail] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [currentStatus, setCurrentStatus] = useState(status);

  useEffect(() => setCurrentStatus(status), [status]);

  const updateStatus = async (
    disabled: boolean,
    disableReason?: string,
    emailOptions?: { notifyMember: boolean; includeReasonInEmail: boolean },
  ) => {
    setSaving(true);
    setError('');
    try {
      const response = await adminMembersApi.setStatus(memberId, {
        disabled,
        ...(disableReason ? { reason: disableReason } : {}),
        ...(emailOptions ?? {}),
      });
      const result = response.data as Partial<MemberStatus>;
      const updatedStatus = {
        isDisabled: result.isDisabled ?? disabled,
        disabledAt: result.disabledAt !== undefined ? result.disabledAt : currentStatus.disabledAt,
        disableReason: result.disableReason !== undefined ? result.disableReason : currentStatus.disableReason,
      };
      onUpdated(updatedStatus);
      setCurrentStatus(updatedStatus);
      setReason('');
      setIsDialogOpen(false);
    } catch {
      setError(t('members.status_update_failed'));
    } finally {
      setSaving(false);
    }
  };

  const handleDialogOpenChange = (isOpen: boolean) => {
    if (isOpen) {
      setNotifyMember(true);
      setIncludeReasonInEmail(false);
      setError('');
    }
    setIsDialogOpen(isOpen);
  };

  return (
    <>
      {currentStatus.isDisabled ? (
        <Button
          size="sm"
          variant="primary"
          data-testid="member-status-toggle"
          isPending={saving}
          onPress={() => void updateStatus(false)}
        >
          {({ isPending }) => <>{isPending && <Spinner color="current" size="sm" />}{t('members.enable_account')}</>}
        </Button>
      ) : (
        <Button
          size="sm"
          variant="danger-soft"
          data-testid="member-status-toggle"
          onPress={() => handleDialogOpenChange(true)}
        >
          {t('members.disable_account_btn')}
        </Button>
      )}
      {error && <p className="text-danger text-sm" role="alert">{error}</p>}

      <Modal.Backdrop isOpen={isDialogOpen} onOpenChange={handleDialogOpenChange}>
        <Modal.Container size="sm">
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header><Modal.Heading>{t('members.disable_account')}</Modal.Heading></Modal.Header>
            <Modal.Body className="flex flex-col gap-3">
              <p className="text-sm text-muted">{t('members.disable_reason_optional')}</p>
              <TextField
                className="w-full"
                value={reason}
                onChange={(nextReason) => {
                  setReason(nextReason);
                  if (!nextReason.trim()) setIncludeReasonInEmail(false);
                }}
                variant="secondary"
              >
                <Label>{t('members.disable_reason')}</Label>
                <TextArea rows={3} data-testid="member-disable-reason" />
              </TextField>
              <Checkbox
                data-testid="member-disable-notify"
                isSelected={notifyMember}
                variant='secondary'
                onChange={(selected) => {
                  setNotifyMember(selected);
                  if (!selected) setIncludeReasonInEmail(false);
                }}
              >
                <Checkbox.Content>
                  <Checkbox.Control><Checkbox.Indicator /></Checkbox.Control>
                  {t('members.disable_notify_member')}
                </Checkbox.Content>
              </Checkbox>
              <Checkbox
                data-testid="member-disable-include-reason"
                isSelected={includeReasonInEmail}
                isDisabled={!notifyMember || !reason.trim()}
                onChange={setIncludeReasonInEmail}
                variant='secondary'
              >
                <Checkbox.Content>
                  <Checkbox.Control><Checkbox.Indicator /></Checkbox.Control>
                  {t('members.disable_include_reason')}
                </Checkbox.Content>
              </Checkbox>
              {error && <p className="text-danger text-sm" role="alert">{error}</p>}
            </Modal.Body>
            <Modal.Footer>
              <Button variant="tertiary" onPress={() => handleDialogOpenChange(false)} isDisabled={saving}>
                {t('common.cancel')}
              </Button>
              <Button
                variant="danger"
                data-testid="member-disable-confirm"
                isPending={saving}
                onPress={() => void updateStatus(true, reason.trim(), { notifyMember, includeReasonInEmail })}
              >
                {({ isPending }) => <>{isPending && <Spinner color="current" size="sm" />}{t('members.disable_account')}</>}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </>
  );
}
