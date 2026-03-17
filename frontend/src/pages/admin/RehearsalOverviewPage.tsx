import { useEffect, useState } from 'react';
import { Tabs, Tab, Spinner, Button, useDisclosure } from '@heroui/react';
import { attendanceApi, rehearsalsApi } from '../../services/api';
import type { RehearsalOverview, Rehearsal } from '../../types';
import { AttendanceDetailModal } from '../../components/rehearsal/AttendanceDetailModal';
import { RehearsalFormModal } from '../../components/rehearsal/RehearsalFormModal';
import { DeleteConfirmModal } from '../../components/rehearsal/DeleteConfirmModal';
import { OverviewCard } from '../../components/rehearsal/OverviewCard';

export function RehearsalOverviewPage() {
  const [future, setFuture] = useState<RehearsalOverview[]>([]);
  const [past, setPast] = useState<RehearsalOverview[]>([]);
  const [rehearsals, setRehearsals] = useState<Rehearsal[]>([]);
  const [loading, setLoading] = useState(true);

  const [selectedRehearsal, setSelectedRehearsal] = useState<RehearsalOverview | null>(null);
  const [selectedType, setSelectedType] = useState<'future' | 'past'>('past');
  const { isOpen, onOpen, onClose } = useDisclosure();

  const [editTarget, setEditTarget] = useState<Rehearsal | null>(null);
  const { isOpen: isFormOpen, onOpen: onFormOpen, onClose: onFormClose } = useDisclosure();

  const [deleteTarget, setDeleteTarget] = useState<Rehearsal | null>(null);
  const { isOpen: isDeleteOpen, onOpen: onDeleteOpen, onClose: onDeleteClose } = useDisclosure();

  const loadData = () =>
    Promise.all([
      attendanceApi.getFutureOverview(),
      attendanceApi.getPastOverview(),
      rehearsalsApi.getAll(),
    ]).then(([f, p, r]) => {
      setFuture(f.data as RehearsalOverview[]);
      setPast(p.data as RehearsalOverview[]);
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

  if (loading) {
    return <div className="flex justify-center pt-8"><Spinner /></div>;
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Probenübersicht</h1>
        <Button color="primary" onPress={openCreate}>
          + Neue Probe
        </Button>
      </div>

      <Tabs aria-label="Probenübersicht">
        <Tab key="future" title={`Bevorstehend (${future.length})`}>
          <div className="flex flex-col gap-3 mt-4">
            {future.length === 0 ? (
              <p className="text-default-500">Keine bevorstehenden Proben.</p>
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
        </Tab>
        <Tab key="past" title={`Vergangen (${past.length})`}>
          <div className="flex flex-col gap-3 mt-4">
            {past.length === 0 ? (
              <p className="text-default-500">Keine vergangenen Proben vorhanden.</p>
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
        </Tab>
      </Tabs>

      {selectedRehearsal && (
        <AttendanceDetailModal
          rehearsal={selectedRehearsal}
          type={selectedType}
          isOpen={isOpen}
          onClose={onClose}
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
    </div>
  );
}
