import { useEffect, useState } from 'react';
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  Button,
  Spinner,
  Input,
  useDisclosure,
} from '@heroui/react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { adminMembersApi } from '../../services/api';
import type { MemberOverview } from '../../types';
import { MemberDetailModal } from '../../components/member/MemberDetailModal';
import { CreateMemberModal } from '../../components/member/CreateMemberModal';
import { VoiceFilterChips } from '../../components/common/VoiceFilterChips';

export function MemberOverviewPage() {
  const [members, setMembers] = useState<MemberOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [search, setSearch] = useState('');
  const [voiceFilter, setVoiceFilter] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState<MemberOverview | null>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const { isOpen: isCreateOpen, onOpen: onCreateOpen, onClose: onCreateClose } = useDisclosure();
  const navigate = useNavigate();
  const { t } = useTranslation();

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
      m.lastName.toLowerCase().includes(q);
    const matchesVoice = !voiceFilter || m.choirVoice?.name === voiceFilter;
    return matchesSearch && matchesVoice;
  });

  useEffect(() => {
    adminMembersApi.list().then((res) => {
      setMembers(res.data as MemberOverview[]);
      setLoading(false);
    });
  }, []);

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
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">{t('members.title')}</h1>
        <div className="flex gap-2 shrink-0">
          <Button size="sm" variant="flat" isLoading={exporting} onPress={handleExport}>
            {t('members.export_excel')}
          </Button>
          <Button
            size="sm"
            variant="flat"
            onPress={() => navigate('/admin/mitglieder/importieren')}
          >
            {t('members.import_csv')}
          </Button>
          <Button color="primary" size="sm" onPress={onCreateOpen}>
            {t('members.create_new')}
          </Button>
        </div>
      </div>
      <Input
        size="sm"
        placeholder={t('members.search_placeholder')}
        value={search}
        onValueChange={setSearch}
        isClearable
      />
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
        <Table
          aria-label={t('members.table_aria')}
          isStriped
          className="[&_tr]:cursor-pointer"
          onRowAction={(key) => {
            const member = members.find((m) => m.id === key);
            if (member) handleRowClick(member);
          }}
        >
          <TableHeader>
            <TableColumn>{t('members.col_name')}</TableColumn>
            <TableColumn>{t('members.col_email')}</TableColumn>
            <TableColumn>{t('members.col_voice')}</TableColumn>
            <TableColumn>{t('members.col_rehearsals')}</TableColumn>
            <TableColumn>{t('members.col_unexcused')}</TableColumn>
          </TableHeader>
          <TableBody emptyContent={t('members.no_members')}>
            {filteredMembers.map((m) => (
              <TableRow key={m.id}>
                <TableCell>{m.lastName}, {m.firstName}</TableCell>
                <TableCell className="text-sm text-default-500">{m.email}</TableCell>
                <TableCell>
                  <Chip size="sm" variant="flat">
                    {m.choirVoice?.name ?? '—'}
                  </Chip>
                </TableCell>
                <TableCell>{m.attendanceCount}</TableCell>
                <TableCell>
                  {m.unexcusedAbsenceCount > 0 ? (
                    <Chip size="sm" color="danger" variant="flat">
                      {m.unexcusedAbsenceCount}
                    </Chip>
                  ) : (
                    <span className="text-default-400">0</span>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      {selectedMember && (
        <MemberDetailModal member={selectedMember} isOpen={isOpen} onClose={onClose} />
      )}

      <CreateMemberModal
        isOpen={isCreateOpen}
        onClose={onCreateClose}
        onCreated={() => adminMembersApi.list().then((res) => setMembers(res.data as MemberOverview[]))}
      />
    </div>
  );
}
