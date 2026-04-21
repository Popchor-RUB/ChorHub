import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import {
  Button,
  Card,
  CardBody,
  Checkbox,
  Input,
  Radio,
  RadioGroup,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Spinner,
  Table,
  TableBody,
  TableCell,
  TableColumn,
  TableHeader,
  TableRow,
  Textarea,
  useDisclosure,
} from '@heroui/react';
import { useTranslation } from 'react-i18next';
import { adminPersonalInfoApi } from '../../services/api';
import type { PersonalInfoMemberRow, PersonalInfoSendStatus } from '../../types';
import { MarkdownEditor } from './MarkdownEditor';
import { adminInputClassNames } from '../../styles/adminFormStyles';

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
    <Card className="border border-divider shadow-sm bg-content1">
      <CardBody className="gap-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-lg font-semibold">{t('info.personal_member_editor_title')}</h2>
          <Input
            size="sm"
            placeholder={t('info.personal_member_search_placeholder')}
            value={search}
            onValueChange={onSearchChange}
            classNames={adminInputClassNames}
          />
        </div>

        <Table aria-label={t('info.personal_member_table_aria')}>
          <TableHeader>
            <TableColumn>{t('members.col_name')}</TableColumn>
            <TableColumn>{t('members.col_email')}</TableColumn>
            <TableColumn>{t('info.personal_member_status')}</TableColumn>
            <TableColumn>{t('common.edit')}</TableColumn>
          </TableHeader>
          <TableBody emptyContent={t('members.no_members')}>
            {members.map((member) => (
              <TableRow key={member.id}>
                <TableCell>{member.firstName} {member.lastName}</TableCell>
                <TableCell>{member.email}</TableCell>
                <TableCell>
                  {member.hasPersonalInfo ? t('info.personal_member_status_ready') : t('info.personal_member_status_empty')}
                </TableCell>
                <TableCell>
                  <Button size="sm" variant="flat" onPress={() => onEditMember(member.id)}>
                    {t('common.edit')}
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardBody>
    </Card>
  );
});

export function AdminPersonalInfoPanel() {
  const { t } = useTranslation();
  const { isOpen, onOpen, onOpenChange, onClose } = useDisclosure();
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
      <Card className="border border-divider shadow-sm bg-content1">
        <CardBody className="gap-4">
          <h2 className="text-lg font-semibold">{t('info.personal_compose_title')}</h2>
          <p className="text-sm text-default-500">{t('info.personal_compose_description')}</p>

          <div className="rounded-xl border border-default-200 bg-default-50 p-4">
            <h3 className="text-sm font-semibold tracking-wide text-default-700">{t('info.personal_recipients_step_title')}</h3>
            <p className="mt-1 text-xs text-default-500">
              {t('info.personal_recipients_selected', { count: selectedRecipientsCount ?? 0 })}
            </p>
            <RadioGroup
              className="mt-3"
              value={recipientMode}
              onValueChange={(value) => {
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
              <Radio value="all">{t('info.personal_recipients_all')}</Radio>
              <Radio value="file">{t('info.personal_recipients_file')}</Radio>
            </RadioGroup>
            {recipientMode === 'file' && (
              <div className="mt-3 flex flex-col gap-3">
                <label className="mb-2 block text-sm font-semibold text-default-700">{t('info.personal_recipients_label')}</label>
                <input
                  type="file"
                  accept=".txt,text/plain"
                  onChange={(event) => { void handleRecipientsFileChange(event.target.files?.[0] ?? null); }}
                  className="text-sm file:mr-2 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-2 file:text-primary"
                />
                <Checkbox isSelected={deleteNonTargetedEntries} onValueChange={setDeleteNonTargetedEntries}>
                  {t('info.personal_delete_non_targeted')}
                </Checkbox>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 rounded-xl border border-default-200 bg-default-50 p-4">
            <h3 className="text-sm font-semibold tracking-wide text-default-700">{t('info.personal_placeholders_step_title')}</h3>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-default-300 px-3 py-1">{'{{firstname}}'}</span>
              <span className="rounded-full border border-default-300 px-3 py-1">{'{{lastname}}'}</span>
              {placeholderRows
                .map((row) => row.name.trim())
                .filter(Boolean)
                .map((name, index) => (
                  <span key={`${name}-${index}`} className="rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-primary-700">
                    {`{{${name}}}`}
                  </span>
                ))}
            </div>
            <div className="flex flex-col gap-3">
              {placeholderRows.map((row) => (
                <div key={row.id} className="grid gap-2 rounded-lg border border-default-200 bg-content1 p-3 md:grid-cols-[1fr_auto_auto] md:items-end">
                  <Input
                    label={t('info.personal_placeholder_name_label')}
                    placeholder="z. B. stipend"
                    value={row.name}
                    onValueChange={(value) => updatePlaceholderRow(row.id, { name: value })}
                    classNames={adminInputClassNames}
                  />
                  <input
                    type="file"
                    accept=".txt,text/plain"
                    onChange={(event) => { void handlePlaceholderFileChange(row.id, event.target.files?.[0] ?? null); }}
                    className="text-sm file:mr-2 file:rounded-md file:border-0 file:bg-primary/10 file:px-3 file:py-2 file:text-primary"
                  />
                  <Button variant="light" color="danger" onPress={() => removePlaceholderRow(row.id)}>
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
            <Button variant="flat" onPress={addPlaceholderRow}>
              {t('info.personal_add_placeholder')}
            </Button>
            {placeholderCountMismatch && (
              <p className="text-xs text-danger">
                {t('info.personal_validation_placeholder_rows_mismatch', { count: selectedRecipientsCount ?? 0 })}
              </p>
            )}
          </div>

          <div className="rounded-xl border border-default-200 bg-default-50 p-4">
            <h3 className="text-sm font-semibold tracking-wide text-default-700">{t('info.personal_message_step_title')}</h3>
            <Input
              className="mt-3"
              label={t('info.personal_subject_label')}
              value={emailSubject}
              onValueChange={setEmailSubject}
              classNames={adminInputClassNames}
            />
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

          <Checkbox isSelected={sendEmail} onValueChange={setSendEmail}>
            {t('info.personal_send_email')}
          </Checkbox>

          <div className="text-sm text-default-600">
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
            <Button color="primary" onPress={handlePublish} isLoading={publishing} isDisabled={isCampaignRunning}>
              {t('info.personal_publish')}
            </Button>
            {isCampaignRunning && <span className="text-warning text-sm">{t('info.personal_campaign_running')}</span>}
            {publishSuccess && <span className="text-success text-sm font-medium">{t('common.saved')}</span>}
            {publishError && <span className="text-danger text-sm">{publishError}</span>}
          </div>
        </CardBody>
      </Card>

      <MemberEditorTable
        members={filteredMembers}
        search={search}
        onSearchChange={setSearch}
        onEditMember={handleOpenMember}
        t={t}
      />

      <Modal isOpen={isOpen} onOpenChange={onOpenChange} size="5xl" backdrop="blur">
        <ModalContent>
          {(modalClose) => (
            <>
              <ModalHeader>{editingMember ? `${editingMember.firstName} ${editingMember.lastName}` : t('common.edit')}</ModalHeader>
              <ModalBody>
                <Textarea
                  value={editingMember?.markdownContent ?? ''}
                  onValueChange={(value) => setEditingMember((prev) => (prev ? { ...prev, markdownContent: value } : prev))}
                  minRows={16}
                  classNames={{
                    ...adminInputClassNames,
                    input: `${adminInputClassNames.input} font-mono text-sm`,
                  }}
                />
              </ModalBody>
              <ModalFooter>
                <Button variant="light" onPress={modalClose}>{t('common.cancel')}</Button>
                <Button color="primary" onPress={handleSaveMember} isLoading={savingMember}>{t('common.save')}</Button>
              </ModalFooter>
            </>
          )}
        </ModalContent>
      </Modal>
    </div>
  );
}
