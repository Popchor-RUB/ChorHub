import { useEffect, useState } from 'react';
import { Tabs, Spinner, Button, useOverlayState } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import { attendanceApi, rehearsalsApi } from '../../services/api';
import type { AdminRehearsalListOverview, RehearsalOverview, Rehearsal, AttendanceRecord } from '../../types';
import { AttendanceDetailModal } from '../../components/rehearsal/AttendanceDetailModal';
import { RehearsalFormModal } from '../../components/rehearsal/RehearsalFormModal';
import { DeleteConfirmModal } from '../../components/rehearsal/DeleteConfirmModal';
import { OverviewCard } from '../../components/rehearsal/OverviewCard';
import { MemberDetailModal } from '../../components/member/MemberDetailModal';

export function RehearsalOverviewPage() {
  const [future, setFuture] = useState<RehearsalOverview[]>([]);
  const [past, setPast] = useState<RehearsalOverview[]>([]);
  const [rehearsals, setRehearsals] = useState<Rehearsal[]>([]);
  const [loading, setLoading] = useState(true);
  const { t } = useTranslation();

  const [selectedRehearsal, setSelectedRehearsal] = useState<RehearsalOverview | null>(null);
  const [selectedType, setSelectedType] = useState<'future' | 'past'>('past');
  const { isOpen, open: onOpen, close: onClose } = useOverlayState();

  const [editTarget, setEditTarget] = useState<Rehearsal | null>(null);
  const { isOpen: isFormOpen, open: onFormOpen, close: onFormClose } = useOverlayState();

  const [deleteTarget, setDeleteTarget] = useState<Rehearsal | null>(null);
  const { isOpen: isDeleteOpen, open: onDeleteOpen, close: onDeleteClose } = useOverlayState();

  const [selectedMember, setSelectedMember] = useState<AttendanceRecord | null>(null);
  const [comments, setComments] = useState<Record<string, string | null>>({});
  const { isOpen: isMemberOpen, open: onMemberOpen, close: onMemberClose } = useOverlayState();

  const loadData = () =>
    Promise.all([
      attendanceApi.getRehearsalListOverview(),
      rehearsalsApi.getAll(),
    ]).then(([overviewResponse, r]) => {
      const overview = overviewResponse.data as AdminRehearsalListOverview;
      setFuture(overview.future);
      setPast(overview.past);
      setRehearsals(r.data as Rehearsal[]);
      setLoading(false);
    });

  useEffect(() => { loadData(); }, []);

  const openDetail = (item: RehearsalOverview, type: 'future' | 'past') => {
    setSelectedRehearsal(item);
    setSelectedType(type);
    onOpen();
  };

  const openCreate = () => {
    setEditTarget(null);
    onFormOpen();
  };

  const openEdit = (item: RehearsalOverview) => {
    const full = rehearsals.find((r) => r.id === item.id);
    if (full) { setEditTarget(full); onFormOpen(); }
  };

  const openDelete = (item: RehearsalOverview) => {
    const full = rehearsals.find((r) => r.id === item.id);
    if (full) { setDeleteTarget(full); onDeleteOpen(); }
  };

  const handleMemberClick = (member: AttendanceRecord) => {
    setSelectedMember(member.id in comments ? { ...member, internalComment: comments[member.id] } : member);
    onMemberOpen();
  };

  if (loading) {
    return <div className="flex justify-center pt-8"><Spinner /></div>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t('rehearsals.overview_title')}</h1>
        <Button onPress={openCreate}>
          {t('rehearsals.new')}
        </Button>
      </div>

      <Tabs>
        <Tabs.ListContainer>
          <Tabs.List aria-label={t('rehearsals.overview_title')}>
            <Tabs.Tab id="future">
              {t('rehearsals.upcoming_count', { count: future.length })}
              <Tabs.Indicator />
            </Tabs.Tab>
            <Tabs.Tab id="past">
              {t('rehearsals.past_count', { count: past.length })}
              <Tabs.Indicator />
            </Tabs.Tab>
          </Tabs.List>
        </Tabs.ListContainer>
        <Tabs.Panel id="future">
          <div className="flex flex-col gap-3 mt-4">
            {future.length === 0 ? (
              <p className="text-muted">{t('rehearsals.no_upcoming_admin')}</p>
            ) : (
              future.map((r) => (
                <OverviewCard
                  key={r.id}
                  item={r}
                  type="future"
                  onClick={() => openDetail(r, 'future')}
                  onEdit={() => openEdit(r)}
                  onDelete={() => openDelete(r)}
                />
              ))
            )}
          </div>
        </Tabs.Panel>
        <Tabs.Panel id="past">
          <div className="flex flex-col gap-3 mt-4">
            {past.length === 0 ? (
              <p className="text-muted">{t('rehearsals.no_past_admin')}</p>
            ) : (
              past.map((r) => (
                <OverviewCard
                  key={r.id}
                  item={r}
                  type="past"
                  onClick={() => openDetail(r, 'past')}
                  onEdit={() => openEdit(r)}
                  onDelete={() => openDelete(r)}
                />
              ))
            )}
          </div>
        </Tabs.Panel>
      </Tabs>

      {selectedRehearsal && (
        <AttendanceDetailModal
          rehearsal={selectedRehearsal}
          type={selectedType}
          isOpen={isOpen}
          onClose={onClose}
          onMemberClick={handleMemberClick}
          comments={comments}
        />
      )}

      <RehearsalFormModal
        rehearsal={editTarget}
        isOpen={isFormOpen}
        onClose={onFormClose}
        onSaved={loadData}
      />

      <DeleteConfirmModal
        rehearsal={deleteTarget}
        isOpen={isDeleteOpen}
        onClose={onDeleteClose}
        onDeleted={loadData}
      />

      {selectedMember && (
        <MemberDetailModal
          member={selectedMember}
          isOpen={isMemberOpen}
          showComment
          onCommentChanged={(memberId, comment) => {
            setComments((current) => ({ ...current, [memberId]: comment }));
            setSelectedMember((current) => current?.id === memberId ? { ...current, internalComment: comment } : current);
          }}
          onClose={onMemberClose}
          onStatusChanged={loadData}
        />
      )}
    </div>
  );
}
