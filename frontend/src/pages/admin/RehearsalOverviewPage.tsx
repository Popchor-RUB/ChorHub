import { useEffect, useState } from 'react';
import {
  Tabs,
  Tab,
  Card,
  CardBody,
  Spinner,
  Chip,
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  useDisclosure,
  Button,
  Input,
  Textarea,
  DatePicker,
} from '@heroui/react';
import { I18nProvider } from '@react-aria/i18n';
import { CalendarDateTime } from '@internationalized/date';
import type { DateValue } from '@internationalized/date';
import { attendanceApi, rehearsalsApi } from '../../services/api';
import type { RehearsalOverview, AttendanceRecord, Rehearsal } from '../../types';

const formatDate = (d: string) =>
  new Intl.DateTimeFormat('de-DE', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(d));

const formatDateLong = (d: string) =>
  new Intl.DateTimeFormat('de-DE', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(new Date(d));

/** A member should have attended but didn't (CONFIRMED or no plan → no show) */
function isUnexpectedAbsence(record: AttendanceRecord): boolean {
  return !record.attended && record.plan !== 'DECLINED';
}

function AttendanceDetailModal({
  rehearsal,
  type,
  isOpen,
  onClose,
}: {
  rehearsal: RehearsalOverview;
  type: 'future' | 'past';
  isOpen: boolean;
  onClose: () => void;
}) {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    attendanceApi.getRecords(rehearsal.id).then((res) => {
      setRecords(res.data as AttendanceRecord[]);
      setLoading(false);
    });
  }, [isOpen, rehearsal.id]);

  // Group records by voice for display (voices come back sorted by sortOrder from backend)
  const voiceNames = [...new Set(records.map((r) => r.choirVoice?.name).filter(Boolean) as string[])];
  const byVoice = voiceNames.map((voice) => ({
    voice,
    members: records.filter((r) => r.choirVoice?.name === voice),
  })).filter((g) => g.members.length > 0);

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="2xl" scrollBehavior="inside">
      <ModalContent>
        <ModalHeader className="flex flex-col gap-0.5">
          <span>{rehearsal.title}</span>
          <span className="text-sm font-normal text-default-500">
            {formatDateLong(rehearsal.date)}
          </span>
        </ModalHeader>
        <ModalBody className="pb-6">
          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          ) : (
            <>
              {/* Summary */}
              <div className="flex flex-wrap gap-2 mb-4">
                {type === 'past' ? (
                  <>
                    <Chip color="success" variant="flat">
                      {records.filter((r) => r.attended).length} anwesend
                    </Chip>
                    <Chip color="danger" variant="flat">
                      {records.filter((r) => isUnexpectedAbsence(r)).length} unentschuldigt gefehlt
                    </Chip>
                    <Chip color="default" variant="flat">
                      {records.filter((r) => !r.attended && r.plan === 'DECLINED').length} entschuldigt
                    </Chip>
                  </>
                ) : (
                  <>
                    <Chip color="success" variant="flat">
                      {records.filter((r) => r.plan === 'CONFIRMED').length} zugesagt
                    </Chip>
                    <Chip color="danger" variant="flat">
                      {records.filter((r) => r.plan === 'DECLINED').length} abgesagt
                    </Chip>
                    <Chip color="default" variant="flat">
                      {records.filter((r) => !r.plan).length} keine Angabe
                    </Chip>
                  </>
                )}
              </div>

              {/* Per-voice member list */}
              {byVoice.map(({ voice, members }) => (
                <div key={voice} className="mb-4">
                  <p className="text-xs font-semibold text-default-400 uppercase tracking-wide mb-1">
                    {voice}
                  </p>
                  <div className="flex flex-col gap-1">
                    {members.map((m) => {
                      const absent = isUnexpectedAbsence(m);
                      return (
                        <div
                          key={m.id}
                          className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
                            type === 'past'
                              ? m.attended
                                ? 'bg-success-50 text-success-800'
                                : absent
                                ? 'bg-danger-50 text-danger-800'
                                : 'bg-default-50 text-default-500'
                              : 'bg-default-50'
                          }`}
                        >
                          <span className="font-medium">
                            {m.lastName}, {m.firstName}
                          </span>
                          {type === 'past' ? (
                            <span className="text-xs">
                              {m.attended
                                ? '✓ anwesend'
                                : m.plan === 'DECLINED'
                                ? 'abgesagt'
                                : '✗ gefehlt'}
                            </span>
                          ) : (
                            <span className="text-xs">
                              {m.plan === 'CONFIRMED'
                                ? '✓ zugesagt'
                                : m.plan === 'DECLINED'
                                ? '✗ abgesagt'
                                : '– keine Angabe'}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}

              {records.length === 0 && (
                <p className="text-default-400 text-center py-4">Keine Mitgliederdaten.</p>
              )}
            </>
          )}
        </ModalBody>
      </ModalContent>
    </Modal>
  );
}

function RehearsalFormModal({
  rehearsal,
  isOpen,
  onClose,
  onSaved,
}: {
  rehearsal: Rehearsal | null;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [date, setDate] = useState<DateValue | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (rehearsal) {
        // Parse ISO date string to CalendarDateTime
        const d = new Date(rehearsal.date);
        setDate(
          new CalendarDateTime(
            d.getFullYear(),
            d.getMonth() + 1,
            d.getDate(),
            d.getHours(),
            d.getMinutes()
          )
        );
        setTitle(rehearsal.title);
        setDescription(rehearsal.description ?? '');
      } else {
        setDate(null);
        setTitle('');
        setDescription('');
      }
    }
  }, [rehearsal, isOpen]);

  const handleSave = async () => {
    if (!date) return;
    setSaving(true);
    try {
      // Convert DateValue to ISO string
      const isoDate = date.toDate('Europe/Berlin').toISOString();
      if (rehearsal) {
        await rehearsalsApi.update(rehearsal.id, {
          date: isoDate,
          title,
          description: description || undefined,
        });
      } else {
        await rehearsalsApi.create({ date: isoDate, title, description: description || undefined });
      }
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="lg">
      <ModalContent>
        <ModalHeader>{rehearsal ? 'Probe bearbeiten' : 'Neue Probe'}</ModalHeader>
        <ModalBody className="pb-2 flex flex-col gap-3">
          <I18nProvider locale="de-DE">
            <DatePicker
              label="Datum und Uhrzeit"
              value={date}
              onChange={setDate}
              showMonthAndYearPickers
              hideTimeZone
              granularity="minute"
              isRequired
              hourCycle={24}
            />
          </I18nProvider>
          <Input
            label="Titel"
            value={title}
            onValueChange={setTitle}
            isRequired
          />
          <Textarea
            label="Beschreibung"
            value={description}
            onValueChange={setDescription}
            placeholder="Optional"
          />
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={onClose}>
            Abbrechen
          </Button>
          <Button
            color="primary"
            isLoading={saving}
            onPress={handleSave}
            isDisabled={!date || !title}
          >
            Speichern
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function DeleteConfirmModal({
  rehearsal,
  isOpen,
  onClose,
  onDeleted,
}: {
  rehearsal: Rehearsal | null;
  isOpen: boolean;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (!rehearsal) return;
    setDeleting(true);
    try {
      await rehearsalsApi.remove(rehearsal.id);
      onDeleted();
      onClose();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <ModalContent>
        <ModalHeader>Probe löschen</ModalHeader>
        <ModalBody className="pb-2">
          <p>
            Soll die Probe <strong>{rehearsal?.title}</strong> wirklich gelöscht werden?
          </p>
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={onClose}>
            Abbrechen
          </Button>
          <Button color="danger" isLoading={deleting} onPress={handleDelete}>
            Löschen
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}

function EditIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4"
    >
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4"
    >
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
      <path d="M10 11v6M14 11v6" />
      <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
    </svg>
  );
}

function OverviewCard({
  item,
  type,
  onClick,
  onEdit,
  onDelete,
}: {
  item: RehearsalOverview;
  type: 'future' | 'past';
  onClick: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const total = type === 'future' ? item.totalConfirmed ?? 0 : item.totalAttended ?? 0;
  return (
    <Card
      isPressable
      onPress={onClick}
      className="w-full text-left hover:shadow-md transition-shadow"
    >
      <CardBody className="gap-2">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <p className="font-semibold">{item.title}</p>
            <p className="text-sm text-default-500">{formatDate(item.date)}</p>
          </div>
          <div className="flex items-center gap-1">
            <Chip color={type === 'future' ? 'primary' : 'success'} variant="flat" size="lg">
              {total} {type === 'future' ? 'zugesagt' : 'anwesend'}
            </Chip>
            <Button
              isIconOnly
              size="sm"
              variant="light"
              aria-label="Probe bearbeiten"
              onPress={onEdit}
            >
              <EditIcon />
            </Button>
            <Button
              isIconOnly
              size="sm"
              variant="light"
              color="danger"
              aria-label="Probe löschen"
              onPress={onDelete}
            >
              <TrashIcon />
            </Button>
            <span className="text-default-300 text-lg ml-1">›</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 mt-1">
          {Object.entries(item.byVoice).map(([name, count]) => (
            <Chip key={name} size="sm" variant="flat">
              {name}: {count}
            </Chip>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

export function RehearsalOverviewPage() {
  const [future, setFuture] = useState<RehearsalOverview[]>([]);
  const [past, setPast] = useState<RehearsalOverview[]>([]);
  const [rehearsals, setRehearsals] = useState<Rehearsal[]>([]);
  const [loading, setLoading] = useState(true);

  // Detail modal
  const [selectedRehearsal, setSelectedRehearsal] = useState<RehearsalOverview | null>(null);
  const [selectedType, setSelectedType] = useState<'future' | 'past'>('past');
  const { isOpen, onOpen, onClose } = useDisclosure();

  // Create / edit modal
  const [editTarget, setEditTarget] = useState<Rehearsal | null>(null);
  const { isOpen: isFormOpen, onOpen: onFormOpen, onClose: onFormClose } = useDisclosure();

  // Delete confirm modal
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

  useEffect(() => {
    loadData();
  }, []);

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
    if (full) {
      setEditTarget(full);
      onFormOpen();
    }
  };

  const openDelete = (item: RehearsalOverview) => {
    const full = rehearsals.find((r) => r.id === item.id);
    if (full) {
      setDeleteTarget(full);
      onDeleteOpen();
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center pt-8">
        <Spinner />
      </div>
    );
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
