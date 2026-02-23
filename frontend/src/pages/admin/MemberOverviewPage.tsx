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
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  useDisclosure,
} from '@heroui/react';
import { useNavigate } from 'react-router-dom';
import { adminMembersApi } from '../../services/api';
import type { MemberOverview, MemberRehearsalEntry } from '../../types';
import { CHOIR_VOICE_LABELS } from '../../types';

const formatDate = (d: string) =>
  new Intl.DateTimeFormat('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(d));

function MemberDetailModal({
  member,
  isOpen,
  onClose,
}: {
  member: MemberOverview;
  isOpen: boolean;
  onClose: () => void;
}) {
  const [rehearsals, setRehearsals] = useState<MemberRehearsalEntry[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    adminMembersApi.rehearsals(member.id).then((res) => {
      setRehearsals(res.data as MemberRehearsalEntry[]);
      setLoading(false);
    });
  }, [isOpen, member.id]);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const past = rehearsals.filter((r) => new Date(r.date) < startOfToday).reverse();
  const upcoming = rehearsals.filter((r) => new Date(r.date) >= startOfToday);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl" scrollBehavior="inside">
      <ModalContent>
        <ModalHeader className="flex flex-col gap-0.5">
          <span>
            {member.firstName} {member.lastName}
          </span>
          <span className="text-sm font-normal text-default-500">
            {CHOIR_VOICE_LABELS[member.choirVoice]} · {member.email}
          </span>
        </ModalHeader>
        <ModalBody className="pb-6">
          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : (
            <>
              {/* Summary chips */}
              <div className="flex flex-wrap gap-2 mb-4">
                <Chip color="success" variant="flat">
                  {past.filter((r) => r.attended).length} anwesend
                </Chip>
                <Chip color="danger" variant="flat">
                  {member.unexcusedAbsenceCount} unentschuldigt gefehlt
                </Chip>
                <Chip color="default" variant="flat">
                  {past.filter((r) => !r.attended && r.plan === 'DECLINED').length} entschuldigt
                </Chip>
                {upcoming.length > 0 && (
                  <Chip color="primary" variant="flat">
                    {upcoming.filter((r) => r.plan === 'CONFIRMED').length} von {upcoming.length} bevorstehend zugesagt
                  </Chip>
                )}
              </div>

              {/* Upcoming rehearsals */}
              {upcoming.length > 0 && (
                <div className="mb-5">
                  <p className="text-xs font-semibold text-default-400 uppercase tracking-wide mb-2">
                    Bevorstehende Proben
                  </p>
                  <div className="flex flex-col gap-1">
                    {upcoming.map((r) => (
                      <div
                        key={r.id}
                        className="flex items-center justify-between px-3 py-2 rounded-lg text-sm bg-default-50"
                      >
                        <span className="font-medium text-default-700">
                          {formatDate(r.date)} – {r.title}
                        </span>
                        <span className="text-xs text-default-500">
                          {r.plan === 'CONFIRMED'
                            ? '✓ zugesagt'
                            : r.plan === 'DECLINED'
                            ? '✗ abgesagt'
                            : '– keine Angabe'}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Past rehearsals */}
              {past.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-default-400 uppercase tracking-wide mb-2">
                    Vergangene Proben
                  </p>
                  <div className="flex flex-col gap-1">
                    {past.map((r) => {
                      const unexcused = !r.attended && r.plan !== 'DECLINED';
                      return (
                        <div
                          key={r.id}
                          className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
                            r.attended
                              ? 'bg-success-50 text-success-800'
                              : unexcused
                              ? 'bg-danger-50 text-danger-800'
                              : 'bg-default-50 text-default-500'
                          }`}
                        >
                          <span className="font-medium">
                            {formatDate(r.date)} – {r.title}
                          </span>
                          <span className="text-xs">
                            {r.attended
                              ? '✓ anwesend'
                              : r.plan === 'DECLINED'
                              ? 'entschuldigt'
                              : '✗ unentsch. gefehlt'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {rehearsals.length === 0 && (
                <p className="text-default-400 text-center py-4">Keine Proben vorhanden.</p>
              )}
            </>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}

export function MemberOverviewPage() {
  const [members, setMembers] = useState<MemberOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [selectedMember, setSelectedMember] = useState<MemberOverview | null>(null);
  const { isOpen, onOpen, onClose } = useDisclosure();
  const navigate = useNavigate();

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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mitglieder</h1>
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="flat"
            isLoading={exporting}
            onPress={handleExport}
          >
            Excel exportieren
          </Button>
          <Button
            color="primary"
            size="sm"
            onPress={() => navigate('/admin/mitglieder/importieren')}
          >
            CSV importieren
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center pt-8">
          <Spinner />
        </div>
      ) : (
        <Table
          aria-label="Mitgliederübersicht"
          isStriped
          className="[&_tr]:cursor-pointer"
          onRowAction={(key) => {
            const member = members.find((m) => m.id === key);
            if (member) handleRowClick(member);
          }}
        >
          <TableHeader>
            <TableColumn>Name</TableColumn>
            <TableColumn>E-Mail</TableColumn>
            <TableColumn>Stimme</TableColumn>
            <TableColumn>Proben</TableColumn>
            <TableColumn>Unentsch. gefehlt</TableColumn>
          </TableHeader>
          <TableBody emptyContent="Keine Mitglieder vorhanden.">
            {members.map((m) => (
              <TableRow key={m.id}>
                <TableCell>{m.lastName}, {m.firstName}</TableCell>
                <TableCell className="text-sm text-default-500">{m.email}</TableCell>
                <TableCell>
                  <Chip size="sm" variant="flat">
                    {CHOIR_VOICE_LABELS[m.choirVoice]}
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
        <MemberDetailModal
          member={selectedMember}
          isOpen={isOpen}
          onClose={onClose}
        />
      )}
    </div>
  );
}
