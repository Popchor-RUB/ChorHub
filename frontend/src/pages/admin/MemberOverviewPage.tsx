import { useEffect, useState } from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import type { SortDescriptor } from '@heroui/react';
import {
  Table,
  Chip,
  Button,
  CloseButton,
  Spinner,
  Input,
  TextField,
  useOverlayState,
} from '@heroui/react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { adminMembersApi } from '../../services/api';
import type { MemberOverview } from '../../types';
import { MemberDetailModal } from '../../components/member/MemberDetailModal';
import { CreateMemberModal } from '../../components/member/CreateMemberModal';
import { MemberActivityStatsPanel } from '../../components/member/MemberActivityStatsPanel';
import { VoiceFilterChips } from '../../components/common/VoiceFilterChips';
import { MemberCommentIndicator } from '../../components/member/MemberCommentIndicator';
import { sortMembers } from '../../utils/sortMembers';

export function MemberOverviewPage() {
  const [members, setMembers] = useState<MemberOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [search, setSearch] = useState('');
  const [voiceFilter, setVoiceFilter] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<'active' | 'disabled'>('active');
  const [sortDescriptor, setSortDescriptor] = useState<SortDescriptor>({ column: 'name', direction: 'ascending' });
  const [selectedMember, setSelectedMember] = useState<MemberOverview | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const { isOpen, open: onOpen, close: onClose } = useOverlayState();
  const { isOpen: isCreateOpen, open: onCreateOpen, close: onCreateClose } = useOverlayState();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const voiceNames = [...new Map(
    members
      .filter((m) => m.choirVoice)
      .map((m) => [m.choirVoice!.name, m.choirVoice!.sortOrder] as const)
  ).entries()]
    .sort((a, b) => a[1] - b[1])
    .map(([name]) => name);

  const filteredMembers = members.filter((m) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      m.firstName.toLowerCase().includes(q) ||
      m.lastName.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q) ||
      `${m.firstName} ${m.lastName}`.toLowerCase().includes(q) || 
      `${m.lastName} ${m.firstName}`.toLowerCase().includes(q.replace(/[,\s]+/, " "));
    const matchesVoice = !voiceFilter || m.choirVoice?.name === voiceFilter;
    return matchesSearch && matchesVoice;
  });
  const sortedMembers = sortMembers(filteredMembers, sortDescriptor, i18n.language);

  useEffect(() => {
    setLoading(true);
    adminMembersApi.list(statusFilter).then((res) => {
      setMembers(res.data as MemberOverview[]);
      setLoading(false);
    });
  }, [statusFilter, refreshKey]);

  const handleRowClick = (member: MemberOverview) => {
    setSelectedMember(member);
    onOpen();
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await adminMembersApi.export();
      const blob = new Blob([res.data as BlobPart], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
      const url = URL.createObjectURL(blob);
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, '0');
      const filename = `Mitglieder_${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}-${pad(now.getMinutes())}.xlsx`;
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <h1 className="text-2xl font-bold">{t('members.title')}</h1>
        <div className="grid grid-cols-3 gap-2 w-full sm:w-auto sm:flex sm:shrink-0">
          <Button size="sm" variant="tertiary" isPending={exporting} onPress={handleExport}>
            {exporting && <Spinner color="current" size="sm" />}
            <span className="sm:hidden">{t('members.export_short')}</span>
            <span className="hidden sm:inline">{t('members.export_excel')}</span>
          </Button>
          <Button
            size="sm"
            variant="tertiary"
            onPress={() => navigate('/admin/mitglieder/importieren')}
          >
            <span className="sm:hidden">{t('members.import_short')}</span>
            <span className="hidden sm:inline">{t('members.import_csv')}</span>
          </Button>
          <Button size="sm" onPress={onCreateOpen}>
            <span className="sm:hidden">{t('members.create_short')}</span>
            <span className="hidden sm:inline">{t('members.create_new')}</span>
          </Button>
        </div>
      </div>
      <MemberActivityStatsPanel />
      <div className="flex gap-2" role="group" aria-label={t('members.status_filter')}>
        <Button
          size="sm"
          variant={statusFilter === 'active' ? 'primary' : 'tertiary'}
          data-testid="members-status-active"
          onPress={() => setStatusFilter('active')}
        >
          {t('members.active_filter')}
        </Button>
        <Button
          size="sm"
          variant={statusFilter === 'disabled' ? 'primary' : 'tertiary'}
          data-testid="members-status-disabled"
          onPress={() => setStatusFilter('disabled')}
        >
          {t('members.disabled_filter')}
        </Button>
      </div>
      <TextField
        className="w-full"
        value={search}
        onChange={setSearch}
        aria-label={t('members.search_placeholder')}
      >
        <div className="flex items-center gap-1">
          <Input placeholder={t('members.search_placeholder')} />
          {search && <CloseButton aria-label={t('members.search_placeholder')} onPress={() => setSearch('')} />}
        </div>
      </TextField>
      <VoiceFilterChips
        voices={voiceNames}
        selected={voiceFilter}
        onChange={setVoiceFilter}
        data-testid="voice-filter-chips"
      />

      {loading ? (
        <div className="flex justify-center pt-8">
          <Spinner />
        </div>
      ) : (
        <Table>
          <Table.ScrollContainer>
          <Table.Content
            aria-label={t('members.table_aria')}
            className="min-w-[700px] [&_tbody_tr]:cursor-pointer"
            sortDescriptor={sortDescriptor}
            onSortChange={setSortDescriptor}
            onRowAction={(key) => {
              const member = members.find((item) => item.id === String(key));
              if (member) handleRowClick(member);
            }}
          >
          <Table.Header>
            <Table.Column allowsSorting isRowHeader id="name">
              {({ sortDirection }) => <Table.SortableColumnHeader sortDirection={sortDirection}>{t('members.col_name')}</Table.SortableColumnHeader>}
            </Table.Column>
            <Table.Column allowsSorting id="email">
              {({ sortDirection }) => <Table.SortableColumnHeader sortDirection={sortDirection}>{t('members.col_email')}</Table.SortableColumnHeader>}
            </Table.Column>
            <Table.Column allowsSorting id="voice">
              {({ sortDirection }) => <Table.SortableColumnHeader sortDirection={sortDirection}>{t('members.col_voice')}</Table.SortableColumnHeader>}
            </Table.Column>
            <Table.Column allowsSorting id="rehearsals">
              {({ sortDirection }) => <Table.SortableColumnHeader sortDirection={sortDirection}>{t('members.col_rehearsals')}</Table.SortableColumnHeader>}
            </Table.Column>
            <Table.Column allowsSorting id="unexcused">
              {({ sortDirection }) => <Table.SortableColumnHeader sortDirection={sortDirection}>{t('members.col_unexcused')}</Table.SortableColumnHeader>}
            </Table.Column>
          </Table.Header>
          <Table.Body renderEmptyState={() => <p className="py-4 text-center text-muted">{t('members.no_members')}</p>}>
            {sortedMembers.map((m) => (
              <Table.Row key={m.id} id={m.id}>
                <Table.Cell>
                  <span className="inline-flex items-center gap-1 text-accent font-medium">
                    <span>{m.firstName} {m.lastName}</span>
                    <MagnifyingGlassIcon className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />
                    <MemberCommentIndicator comment={m.internalComment} />
                  </span>
                </Table.Cell>
                <Table.Cell className="text-sm text-muted">{m.email}</Table.Cell>
                <Table.Cell>
                  <Chip size="sm" variant="tertiary">
                    {m.choirVoice?.name ?? '—'}
                  </Chip>
                </Table.Cell>
                <Table.Cell>{m.attendanceCount}</Table.Cell>
                <Table.Cell>
                  {m.unexcusedAbsenceCount > 0 ? (
                    <Chip size="sm" className='bg-danger-soft text-danger-soft-foreground' variant="primary">
                      {m.unexcusedAbsenceCount}
                    </Chip>
                  ) : (
                    <Chip size="sm" color="default" variant="primary">
                      {m.unexcusedAbsenceCount}
                    </Chip>
                  )}
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
          </Table.Content>
          </Table.ScrollContainer>
        </Table>
      )}

      {selectedMember && (
        <MemberDetailModal
          member={selectedMember}
          isOpen={isOpen}
          showComment
          onCommentChanged={(memberId, comment) => {
            setMembers((current) => current.map((member) => member.id === memberId ? { ...member, internalComment: comment } : member));
            setSelectedMember((current) => current?.id === memberId ? { ...current, internalComment: comment } : current);
          }}
          onClose={onClose}
          onStatusChanged={() => {
            setSelectedMember(null);
            onClose();
            setRefreshKey((current) => current + 1);
          }}
        />
      )}

      <CreateMemberModal
        isOpen={isCreateOpen}
        onClose={onCreateClose}
        onCreated={() => setRefreshKey((current) => current + 1)}
      />
    </div>
  );
}
