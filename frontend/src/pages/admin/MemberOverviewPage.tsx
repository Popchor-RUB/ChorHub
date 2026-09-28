import { useCallback, useEffect, useMemo, useState } from 'react';
import type { SortDescriptor } from '@heroui/react';
import {
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
import { MemberOverviewTable } from '../../components/member/MemberOverviewTable';
import { VoiceFilterChips } from '../../components/common/VoiceFilterChips';
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
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const { isOpen: isCreateOpen, open: onCreateOpen, close: onCreateClose } = useOverlayState();
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const voiceNames = useMemo(() => [...new Map(
    members
      .filter((member) => member.choirVoice)
      .map((member) => [member.choirVoice!.name, member.choirVoice!.sortOrder] as const)
  ).entries()]
    .sort((first, second) => first[1] - second[1])
    .map(([name]) => name), [members]);

  const filteredMembers = useMemo(() => {
    const q = search.trim().toLowerCase();
    const reversedQuery = q.replace(/[,\s]+/, ' ');
    return members.filter((member) => {
      const matchesSearch =
        !q ||
        member.firstName.toLowerCase().includes(q) ||
        member.lastName.toLowerCase().includes(q) ||
        member.email.toLowerCase().includes(q) ||
        `${member.firstName} ${member.lastName}`.toLowerCase().includes(q) ||
        `${member.lastName} ${member.firstName}`.toLowerCase().includes(reversedQuery);
      const matchesVoice = !voiceFilter || member.choirVoice?.name === voiceFilter;
      return matchesSearch && matchesVoice;
    });
  }, [members, search, voiceFilter]);
  const sortedMembers = useMemo(
    () => sortMembers(filteredMembers, sortDescriptor, i18n.language),
    [filteredMembers, sortDescriptor, i18n.language],
  );

  useEffect(() => {
    setLoading(true);
    adminMembersApi.list(statusFilter).then((res) => {
      setMembers(res.data as MemberOverview[]);
      setLoading(false);
    });
  }, [statusFilter, refreshKey]);

  const handleRowClick = useCallback((member: MemberOverview) => {
    setSelectedMember(member);
    setIsDetailOpen(true);
  }, []);
  const closeDetail = useCallback(() => setIsDetailOpen(false), []);

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
        <MemberOverviewTable
          members={sortedMembers}
          sortDescriptor={sortDescriptor}
          onSortChange={setSortDescriptor}
          onSelectMember={handleRowClick}
        />
      )}

      {selectedMember && (
        <MemberDetailModal
          member={selectedMember}
          isOpen={isDetailOpen}
          showComment
          onCommentChanged={(memberId, comment) => {
            setMembers((current) => current.map((member) => member.id === memberId ? { ...member, internalComment: comment } : member));
            setSelectedMember((current) => current?.id === memberId ? { ...current, internalComment: comment } : current);
          }}
          onClose={closeDetail}
          onStatusChanged={() => {
            setSelectedMember(null);
            closeDetail();
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
