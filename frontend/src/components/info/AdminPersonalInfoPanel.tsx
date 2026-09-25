import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  Button,
  Card,
  Checkbox,
  Input,
  Label,
  Radio,
  RadioGroup,
  Modal,
  Spinner,
  Table,
  TextArea,
  TextField,
  useOverlayState,
} from '@heroui/react';
import { useTranslation } from 'react-i18next';
import { adminPersonalInfoApi } from '../../services/api';
import type { PersonalInfoMemberRow, PersonalInfoSendStatus } from '../../types';
import { MarkdownEditor } from './MarkdownEditor';

interface PlaceholderFileRow {
  id: string;
  name: string;
  file: File | null;
  lineCount: number | null;
}

interface MemberTableProps {
  members: PersonalInfoMemberRow[];
  search: string;
  onSearchChange: (value: string) => void;
  onEditMember: (memberId: string) => void;
  t: (key: string) => string;
}

const MemberEditorTable = memo(function MemberEditorTable({
  members,
  search,
  onSearchChange,
  onEditMember,
  t,
}: MemberTableProps) {
  return (
    <Card>
      <Card.Content className="gap-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold">{t('info.personal_member_editor_title')}</h2>
          <TextField
            className="w-full sm:max-w-xs"
            variant="secondary"
            value={search}
            onChange={onSearchChange}
            aria-label={t('info.personal_member_search_placeholder')}
          ><Input placeholder={t('info.personal_member_search_placeholder')} /></TextField>
        </div>

        <Table variant="secondary">
          <Table.ScrollContainer><Table.Content aria-label={t('info.personal_member_table_aria')} className="min-w-[640px]">
          <Table.Header>
            <Table.Column isRowHeader>{t('members.col_name')}</Table.Column>
            <Table.Column>{t('members.col_email')}</Table.Column>
            <Table.Column>{t('info.personal_member_status')}</Table.Column>
            <Table.Column>{t('common.edit')}</Table.Column>
          </Table.Header>
          <Table.Body renderEmptyState={() => <p className="py-4 text-center text-muted">{t('members.no_members')}</p>}>
            {members.map((member) => (
              <Table.Row key={member.id} id={member.id}>
                <Table.Cell>{member.firstName} {member.lastName}</Table.Cell>
                <Table.Cell>{member.email}</Table.Cell>
                <Table.Cell>
                  {member.hasPersonalInfo ? t('info.personal_member_status_ready') : t('info.personal_member_status_empty')}
                </Table.Cell>
                <Table.Cell>
                  <Button size="sm" variant="tertiary" onPress={() => onEditMember(member.id)}>
                    {t('common.edit')}
                  </Button>
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
          </Table.Content></Table.ScrollContainer>
        </Table>
      </Card.Content>
    </Card>
  );
});

export function AdminPersonalInfoPanel() {
  const { t } = useTranslation();
  const { isOpen, open: onOpen, setOpen: onOpenChange, close: onClose } = useOverlayState();
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [savingMember, setSavingMember] = useState(false);
  const [publishError, setPublishError] = useState('');
  const [publishSuccess, setPublishSuccess] = useState(false);
  const [sendStatus, setSendStatus] = useState<PersonalInfoSendStatus | null>(null);
  const [members, setMembers] = useState<PersonalInfoMemberRow[]>([]);
  const [search, setSearch] = useState('');
  const [markdownTemplate, setMarkdownTemplate] = useState('');
  const [emailSubject, setEmailSubject] = useState('');
  const [sendEmail, setSendEmail] = useState(false);
  const [deleteNonTargetedEntries, setDeleteNonTargetedEntries] = useState(false);
  const [recipientMode, setRecipientMode] = useState<'all' | 'file'>('file');
  const [recipientsFile, setRecipientsFile] = useState<File | null>(null);
  const [recipientsCount, setRecipientsCount] = useState<number | null>(null);
  const [placeholderRows, setPlaceholderRows] = useState<PlaceholderFileRow[]>([]);

  const [editingMember, setEditingMember] = useState<{
    id: string;
    firstName: string;
    lastName: string;
    markdownContent: string;
  } | null>(null);

  const loadData = async () => {
    const [configRes, membersRes] = await Promise.all([
      adminPersonalInfoApi.getConfig(),
      adminPersonalInfoApi.listMembers(),
    ]);
    setMarkdownTemplate(configRes.data.markdownTemplate ?? '');
    setEmailSubject(configRes.data.emailSubject ?? '');
    setMembers(membersRes.data);
  };

  const loadSendStatus = useCallback(async () => {
    const statusRes = await adminPersonalInfoApi.getSendStatus();
    setSendStatus(statusRes.data);
  }, []);

  useEffect(() => {
    Promise.all([loadData(), loadSendStatus()])
      .catch(() => setPublishError(t('common.error_generic')))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (sendStatus?.status !== 'RUNNING') {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      void loadSendStatus();
    }, 5_000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [loadSendStatus, sendStatus?.status]);

  const parseRawLineCount = useCallback(async (file: File): Promise<number> => {
    const text = await file.text();
    const normalized = text.replace(/\r/g, '');
    const lines = normalized.split('\n');
    if (lines.length > 0 && lines[lines.length - 1] === '') {
      lines.pop();
    }
    return lines.length;
  }, []);

  const parseRecipientCount = useCallback(async (file: File): Promise<number> => {
    const text = await file.text();
    const normalized = text.replace(/\r/g, '');
    return normalized
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .length;
  }, []);

  const filteredMembers = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) {
      return members;
    }

    return members.filter((member) => {
      const fullName = `${member.firstName} ${member.lastName}`.toLowerCase();
      const reverseName = `${member.lastName} ${member.firstName}`.toLowerCase();
      return (
        fullName.includes(query)
        || reverseName.includes(query)
        || member.email.toLowerCase().includes(query)
      );
    });
  }, [members, search]);

  const updatePlaceholderRow = (id: string, patch: Partial<PlaceholderFileRow>) => {
    setPlaceholderRows((rows) => rows.map((row) => (row.id === id ? { ...row, ...patch } : row)));
  };

  const removePlaceholderRow = (id: string) => {
    setPlaceholderRows((rows) => rows.filter((row) => row.id !== id));
  };

  const addPlaceholderRow = () => {
    setPlaceholderRows((rows) => [...rows, { id: crypto.randomUUID(), name: '', file: null, lineCount: null }]);
  };

  const handleRecipientsFileChange = useCallback(async (file: File | null) => {
    setRecipientsFile(file);
    if (!file) {
      setRecipientsCount(null);
      return;
    }

    const count = await parseRecipientCount(file);
    setRecipientsCount(count);
  }, [parseRecipientCount]);

  const handlePlaceholderFileChange = useCallback(async (id: string, file: File | null) => {
    if (!file) {
      updatePlaceholderRow(id, { file: null, lineCount: null });
      return;
    }

    const count = await parseRawLineCount(file);
    updatePlaceholderRow(id, { file, lineCount: count });
  }, [parseRawLineCount]);

  const selectedRecipientsCount = useMemo(() => {
    if (recipientMode === 'all') {
      return members.length;
    }
    return recipientsCount;
  }, [members.length, recipientMode, recipientsCount]);

  const placeholderCountMismatch = useMemo(() => {
    if (selectedRecipientsCount === null) {
      return false;
    }
    return placeholderRows.some((row) => row.lineCount !== null && row.lineCount !== selectedRecipientsCount);
  }, [placeholderRows, selectedRecipientsCount]);

  const validatePublishInput = () => {
    if (recipientMode === 'file' && !recipientsFile) {
      return t('info.personal_validation_recipients_required');
    }
    if (!selectedRecipientsCount || selectedRecipientsCount <= 0) {
      return t('info.personal_validation_recipients_empty');
    }

    for (const row of placeholderRows) {
      if (!row.name.trim()) {
        return t('info.personal_validation_placeholder_name_required');
      }
      if (!row.file) {
        return t('info.personal_validation_placeholder_file_required');
      }
      if (row.lineCount !== selectedRecipientsCount) {
        return t('info.personal_validation_placeholder_rows_mismatch', { count: selectedRecipientsCount });
      }
    }

    if (!emailSubject.trim()) {
      return t('info.personal_validation_subject_required');
    }
    if (!markdownTemplate.trim()) {
      return t('info.personal_validation_template_required');
    }

    return '';
  };

  const getErrorMessage = (error: unknown) => {
    if (axios.isAxiosError(error)) {
      return error.response?.data?.error?.message ?? t('common.error_generic');
    }
    return t('common.error_generic');
  };

  const handlePublish = async () => {
    setPublishError('');
    setPublishSuccess(false);

    const validationError = validatePublishInput();
    if (validationError) {
      setPublishError(validationError);
      return;
    }

    setPublishing(true);
    try {
      await adminPersonalInfoApi.publishConfig({
        markdownTemplate,
        emailSubject,
        sendEmail,
        deleteNonTargetedEntries,
        recipientMode,
        recipientsFile: recipientsFile ?? undefined,
        placeholders: placeholderRows.map((row) => ({
          name: row.name.trim(),
          file: row.file as File,
        })),
      });
      await loadData();
      await loadSendStatus();
      setSendEmail(false);
      setPublishSuccess(true);
      setTimeout(() => setPublishSuccess(false), 2200);
    } catch (error: unknown) {
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        await loadSendStatus();
      }
      setPublishError(getErrorMessage(error));
    } finally {
      setPublishing(false);
    }
  };

  const handleOpenMember = useCallback(async (memberId: string) => {
    try {
      const res = await adminPersonalInfoApi.getMember(memberId);
      setEditingMember({
        id: res.data.id,
        firstName: res.data.firstName,
        lastName: res.data.lastName,
        markdownContent: res.data.personalInfo.markdownContent,
      });
      onOpen();
    } catch {
      setPublishError(t('common.error_generic'));
    }
  }, [onOpen, t]);

  const handleSaveMember = async () => {
    if (!editingMember) {
      return;
    }

    setSavingMember(true);
    try {
      await adminPersonalInfoApi.updateMember(editingMember.id, editingMember.markdownContent);
      await loadData();
      onClose();
      setEditingMember(null);
    } catch (error: unknown) {
      setPublishError(getErrorMessage(error));
    } finally {
      setSavingMember(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center pt-8"><Spinner /></div>;
  }

  const isCampaignRunning = sendStatus?.status === 'RUNNING';

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <Card.Content className="gap-4">
          <h2 className="text-lg font-semibold">{t('info.personal_compose_title')}</h2>
          <p className="text-sm text-muted">{t('info.personal_compose_description')}</p>

          <div className="rounded-xl border border-border bg-surface-secondary p-4">
            <h3 className="text-sm font-semibold tracking-wide text-foreground">{t('info.personal_recipients_step_title')}</h3>
            <p className="mt-1 text-xs text-muted">
              {t('info.personal_recipients_selected', { count: selectedRecipientsCount ?? 0 })}
            </p>
            <RadioGroup
              className="mt-3"
              value={recipientMode}
              onChange={(value) => {
                const nextMode = value === 'all' ? 'all' : 'file';
                setRecipientMode(nextMode);
                if (nextMode === 'all') {
                  setRecipientsFile(null);
                  setRecipientsCount(members.length);
                  setDeleteNonTargetedEntries(false);
                } else {
                  setRecipientsCount(null);
                }
              }}
            >
              <Radio value="all"><Radio.Content><Radio.Control><Radio.Indicator /></Radio.Control>{t('info.personal_recipients_all')}</Radio.Content></Radio>
              <Radio value="file"><Radio.Content><Radio.Control><Radio.Indicator /></Radio.Control>{t('info.personal_recipients_file')}</Radio.Content></Radio>
            </RadioGroup>
            {recipientMode === 'file' && (
              <div className="mt-3 flex flex-col gap-3">
                <label className="mb-2 block text-sm font-semibold text-foreground">{t('info.personal_recipients_label')}</label>
                <input
                  type="file"
                  accept=".txt,text/plain"
                  onChange={(event) => { void handleRecipientsFileChange(event.target.files?.[0] ?? null); }}
                  className="text-sm file:mr-2 file:rounded-md file:border-0 file:bg-accent/10 file:px-3 file:py-2 file:text-accent"
                />
                <Checkbox isSelected={deleteNonTargetedEntries} onChange={setDeleteNonTargetedEntries}>
                  <Checkbox.Content><Checkbox.Control><Checkbox.Indicator /></Checkbox.Control>{t('info.personal_delete_non_targeted')}</Checkbox.Content>
                </Checkbox>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 rounded-xl border border-border bg-surface-secondary p-4">
            <h3 className="text-sm font-semibold tracking-wide text-foreground">{t('info.personal_placeholders_step_title')}</h3>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-border px-3 py-1">{'{{firstname}}'}</span>
              <span className="rounded-full border border-border px-3 py-1">{'{{lastname}}'}</span>
              {placeholderRows
                .map((row) => row.name.trim())
                .filter(Boolean)
                .map((name, index) => (
                  <span key={`${name}-${index}`} className="rounded-full border border-accent/40 bg-accent/10 px-3 py-1 text-accent">
                    {`{{${name}}}`}
                  </span>
                ))}
            </div>
            <div className="flex flex-col gap-3">
              {placeholderRows.map((row) => (
                <div key={row.id} className="grid gap-2 rounded-xl border border-border bg-surface p-3 md:grid-cols-[1fr_auto_auto] md:items-end">
                  <TextField
                    className="w-full"
                    variant="secondary"
                    value={row.name}
                    onChange={(value) => updatePlaceholderRow(row.id, { name: value })}
                  >
                    <Label>{t('info.personal_placeholder_name_label')}</Label>
                    <Input placeholder="z. B. stipend" />
                  </TextField>
                  <input
                    type="file"
                    accept=".txt,text/plain"
                    onChange={(event) => { void handlePlaceholderFileChange(row.id, event.target.files?.[0] ?? null); }}
                    className="text-sm file:mr-2 file:rounded-md file:border-0 file:bg-accent/10 file:px-3 file:py-2 file:text-accent"
                  />
                  <Button variant="danger-soft" onPress={() => removePlaceholderRow(row.id)}>
                    {t('common.delete')}
                  </Button>
                  {row.lineCount !== null && selectedRecipientsCount !== null && row.lineCount !== selectedRecipientsCount && (
                    <p className="md:col-span-3 text-xs text-danger">
                      {t('info.personal_validation_placeholder_rows_mismatch', { count: selectedRecipientsCount })}
                    </p>
                  )}
                </div>
              ))}
            </div>
            <Button variant="tertiary" onPress={addPlaceholderRow}>
              {t('info.personal_add_placeholder')}
            </Button>
            {placeholderCountMismatch && (
              <p className="text-xs text-danger">
                {t('info.personal_validation_placeholder_rows_mismatch', { count: selectedRecipientsCount ?? 0 })}
              </p>
            )}
          </div>

          <div className="rounded-xl border border-border bg-surface-secondary p-4">
            <h3 className="text-sm font-semibold tracking-wide text-foreground">{t('info.personal_message_step_title')}</h3>
            <TextField
              className="mt-3"
              value={emailSubject}
              onChange={setEmailSubject}
            >
              <Label>{t('info.personal_subject_label')}</Label><Input />
            </TextField>
            <div className="mt-3">
              <MarkdownEditor
                value={markdownTemplate}
                onChange={setMarkdownTemplate}
                onSave={handlePublish}
                saving={publishing}
                hideSaveButton
              />
            </div>
          </div>

          <Checkbox isSelected={sendEmail} onChange={setSendEmail}>
            <Checkbox.Content><Checkbox.Control><Checkbox.Indicator /></Checkbox.Control>{t('info.personal_send_email')}</Checkbox.Content>
          </Checkbox>

          <div className="text-sm text-muted">
            <p className="font-medium">{t('info.personal_send_status_label')}</p>
            {sendStatus && (
              <>
                {sendStatus.status === 'IDLE' && (
                  <p>{t('info.personal_send_status_idle')}</p>
                )}
                {sendStatus.status === 'RUNNING' && (
                  <p>
                    {t('info.personal_send_status_running', {
                      sent: sendStatus.sent,
                      total: sendStatus.total,
                      remaining: sendStatus.remaining,
                    })}
                  </p>
                )}
                {sendStatus.status === 'COMPLETED' && (
                  <p>{t('info.personal_send_status_completed', { total: sendStatus.total })}</p>
                )}
                {sendStatus.status === 'FAILED' && (
                  <p>{t('info.personal_send_status_failed', { failed: sendStatus.failed, total: sendStatus.total })}</p>
                )}
                {sendStatus.lastError && (
                  <p className="text-danger">{t('info.personal_send_status_error', { message: sendStatus.lastError })}</p>
                )}
              </>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Button onPress={handlePublish} isPending={publishing} isDisabled={isCampaignRunning}>
              {({ isPending }) => <>{isPending && <Spinner color="current" size="sm" />}{t('info.personal_publish')}</>}
            </Button>
            {isCampaignRunning && <span className="text-warning text-sm">{t('info.personal_campaign_running')}</span>}
            {publishSuccess && <span className="text-success text-sm font-medium">{t('common.saved')}</span>}
            {publishError && <span className="text-danger text-sm">{publishError}</span>}
          </div>
        </Card.Content>
      </Card>

      <MemberEditorTable
        members={filteredMembers}
        search={search}
        onSearchChange={setSearch}
        onEditMember={handleOpenMember}
        t={t}
      />

      <Modal.Backdrop isOpen={isOpen} onOpenChange={onOpenChange} variant="blur">
        <Modal.Container size="lg">
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header><Modal.Heading>{editingMember ? `${editingMember.firstName} ${editingMember.lastName}` : t('common.edit')}</Modal.Heading></Modal.Header>
            <Modal.Body>
              <TextField
                className="w-full"
                variant="secondary"
                value={editingMember?.markdownContent ?? ''}
                onChange={(value) => setEditingMember((prev) => (prev ? { ...prev, markdownContent: value } : prev))}
              >
                <Label className="sr-only">{t('common.edit')}</Label>
                <TextArea rows={16} className="font-mono text-sm" />
              </TextField>
            </Modal.Body>
            <Modal.Footer>
              <Button variant="tertiary" onPress={onClose}>{t('common.cancel')}</Button>
              <Button onPress={handleSaveMember} isPending={savingMember}>
                {({ isPending }) => <>{isPending && <Spinner color="current" size="sm" />}{t('common.save')}</>}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </div>
  );
}
