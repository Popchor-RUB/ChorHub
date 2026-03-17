import { useEffect, useState } from 'react';
import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Spinner,
  useDisclosure,
} from '@heroui/react';
import { choirVoicesApi } from '../../services/api';
import type { ChoirVoice } from '../../types';

export function OptionsPage() {
  const [voices, setVoices] = useState<ChoirVoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const addModal = useDisclosure();
  const deleteModal = useDisclosure();

  const load = async () => {
    const res = await choirVoicesApi.list().catch(() => ({ data: [] }));
    setVoices(res.data as ChoirVoice[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    setAdding(true);
    setError(null);
    try {
      await choirVoicesApi.create(newName.trim());
      setNewName('');
      addModal.onClose();
      await load();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message
        ?? 'Fehler beim Erstellen';
      setError(msg);
    } finally {
      setAdding(false);
    }
  };

  const handleRenameStart = (voice: ChoirVoice) => {
    setEditingId(voice.id);
    setEditName(voice.name);
    setError(null);
  };

  const handleRenameCommit = async (id: string) => {
    if (!editName.trim()) { setEditingId(null); return; }
    setError(null);
    try {
      await choirVoicesApi.update(id, { name: editName.trim() });
      setEditingId(null);
      await load();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message
        ?? 'Fehler beim Umbenennen';
      setError(msg);
    }
  };

  const handleMove = async (voice: ChoirVoice, direction: 'up' | 'down') => {
    const idx = voices.findIndex((v) => v.id === voice.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= voices.length) return;
    const swapVoice = voices[swapIdx];
    await Promise.all([
      choirVoicesApi.update(voice.id, { sortOrder: swapVoice.sortOrder }),
      choirVoicesApi.update(swapVoice.id, { sortOrder: voice.sortOrder }),
    ]);
    await load();
  };

  const handleDeleteConfirm = async () => {
    if (!deletingId) return;
    setError(null);
    try {
      await choirVoicesApi.remove(deletingId);
      deleteModal.onClose();
      setDeletingId(null);
      await load();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message
        ?? 'Fehler beim Löschen';
      setError(msg);
      deleteModal.onClose();
    }
  };

  const deletingVoice = voices.find((v) => v.id === deletingId);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">Einstellungen</h1>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Stimmlagen</h2>
          <Button
            color="primary"
            size="sm"
            onPress={() => { setNewName(''); setError(null); addModal.onOpen(); }}
          >
            Stimmlage hinzufügen
          </Button>
        </div>

        {error && (
          <div className="text-sm text-danger bg-danger-50 dark:bg-danger-50/10 border border-danger-200 rounded-lg px-3 py-2">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center pt-8"><Spinner /></div>
        ) : voices.length === 0 ? (
          <p className="text-default-400 text-sm">Keine Stimmlagen vorhanden.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {voices.map((voice, idx) => (
              <div
                key={voice.id}
                className="flex items-center gap-3 px-4 py-3 bg-default-50 dark:bg-default-100/5 rounded-xl border border-default-200"
              >
                {editingId === voice.id ? (
                  <Input
                    autoFocus
                    size="sm"
                    value={editName}
                    onValueChange={setEditName}
                    className="flex-1"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRenameCommit(voice.id);
                      if (e.key === 'Escape') setEditingId(null);
                    }}
                  />
                ) : (
                  <span className="flex-1 font-medium flex items-center gap-2">
                    {voice.name}
                    {voice.memberCount !== undefined && (
                      <span className="text-xs text-default-400 font-normal">
                        {voice.memberCount} {voice.memberCount === 1 ? 'Mitglied' : 'Mitglieder'}
                      </span>
                    )}
                  </span>
                )}

                <div className="flex gap-1 shrink-0">
                  {editingId === voice.id ? (
                    <>
                      <Button size="sm" color="primary" onPress={() => handleRenameCommit(voice.id)}>
                        Speichern
                      </Button>
                      <Button size="sm" variant="flat" onPress={() => setEditingId(null)}>
                        Abbrechen
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" variant="flat" onPress={() => handleRenameStart(voice)} isIconOnly aria-label="Umbenennen">
                        ✏️
                      </Button>
                      <Button
                        size="sm"
                        variant="flat"
                        onPress={() => handleMove(voice, 'up')}
                        isDisabled={idx === 0}
                        isIconOnly
                        aria-label="Nach oben"
                      >
                        ↑
                      </Button>
                      <Button
                        size="sm"
                        variant="flat"
                        onPress={() => handleMove(voice, 'down')}
                        isDisabled={idx === voices.length - 1}
                        isIconOnly
                        aria-label="Nach unten"
                      >
                        ↓
                      </Button>
                      <Button
                        size="sm"
                        color="danger"
                        variant="flat"
                        onPress={() => { setDeletingId(voice.id); setError(null); deleteModal.onOpen(); }}
                        isIconOnly
                        aria-label="Löschen"
                      >
                        🗑
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Add modal */}
      <Modal isOpen={addModal.isOpen} onClose={addModal.onClose}>
        <ModalContent>
          <ModalHeader>Neue Stimmlage</ModalHeader>
          <ModalBody>
            <Input
              autoFocus
              label="Name"
              placeholder="z.B. Sopran"
              value={newName}
              onValueChange={setNewName}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
            />
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={addModal.onClose}>Abbrechen</Button>
            <Button color="primary" isLoading={adding} onPress={handleAdd} isDisabled={!newName.trim()}>
              Hinzufügen
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Delete confirm modal */}
      <Modal isOpen={deleteModal.isOpen} onClose={deleteModal.onClose}>
        <ModalContent>
          <ModalHeader>Stimmlage löschen</ModalHeader>
          <ModalBody>
            <p>
              Soll die Stimmlage <strong>{deletingVoice?.name}</strong> wirklich gelöscht werden?
              Dies ist nur möglich, wenn ihr keine Mitglieder zugeordnet sind.
            </p>
          </ModalBody>
          <ModalFooter>
            <Button variant="flat" onPress={deleteModal.onClose}>Abbrechen</Button>
            <Button color="danger" onPress={handleDeleteConfirm}>Löschen</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}
