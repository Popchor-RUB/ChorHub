import { useEffect, useState } from 'react';
import {
  Button,
  Input,
  Label,
  Modal,
  Spinner,
  TextField,
  useOverlayState,
} from '@heroui/react';
import { useTranslation } from 'react-i18next';
import { AdminMailTemplatesSection } from '../../components/admin/mail-templates/AdminMailTemplatesSection';
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
  const { t } = useTranslation();

  const addModal = useOverlayState();
  const deleteModal = useOverlayState();

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
      addModal.close();
      await load();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message
        ?? t('voice.error_create');
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
        ?? t('voice.error_rename');
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
      deleteModal.close();
      setDeletingId(null);
      await load();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { error?: { message?: string } } } })?.response?.data?.error?.message
        ?? t('voice.error_delete');
      setError(msg);
      deleteModal.close();
    }
  };

  const deletingVoice = voices.find((v) => v.id === deletingId);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-bold">{t('settings.title')}</h1>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t('voice.section_title')}</h2>
          <Button
            size="sm"
            onPress={() => { setNewName(''); setError(null); addModal.open(); }}
          >
            {t('voice.add')}
          </Button>
        </div>

        {error && (
          <div className="rounded-xl border border-danger/20 bg-danger-soft px-3 py-2 text-sm text-danger-soft-foreground">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center pt-8"><Spinner /></div>
        ) : voices.length === 0 ? (
          <p className="text-muted text-sm">{t('voice.no_voices_admin')}</p>
        ) : (
          <div className="flex flex-col gap-2">
            {voices.map((voice, idx) => (
              <div
                key={voice.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-surface-secondary px-4 py-3"
              >
                {editingId === voice.id ? (
                  <TextField
                    className="flex-1"
                    value={editName}
                    onChange={setEditName}
                  >
                    <Input autoFocus onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRenameCommit(voice.id);
                      if (e.key === 'Escape') setEditingId(null);
                    }} />
                  </TextField>
                ) : (
                  <span className="flex-1 font-medium flex items-center gap-2">
                    {voice.name}
                    {voice.memberCount !== undefined && (
                      <span className="text-xs text-muted font-normal">
                        {voice.memberCount}{' '}
                        {t(voice.memberCount === 1 ? 'common.member_one' : 'common.member_other')}
                      </span>
                    )}
                  </span>
                )}

                <div className="flex gap-1 shrink-0">
                  {editingId === voice.id ? (
                    <>
                      <Button size="sm" onPress={() => handleRenameCommit(voice.id)}>
                        {t('common.save')}
                      </Button>
                      <Button size="sm" variant="tertiary" onPress={() => setEditingId(null)}>
                        {t('common.cancel')}
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button size="sm" variant="tertiary" onPress={() => handleRenameStart(voice)} isIconOnly aria-label={t('common.rename')}>
                        ✏️
                      </Button>
                      <Button
                        size="sm"
                        variant="tertiary"
                        onPress={() => handleMove(voice, 'up')}
                        isDisabled={idx === 0}
                        isIconOnly
                        aria-label={t('voice.move_up')}
                      >
                        ↑
                      </Button>
                      <Button
                        size="sm"
                        variant="tertiary"
                        onPress={() => handleMove(voice, 'down')}
                        isDisabled={idx === voices.length - 1}
                        isIconOnly
                        aria-label={t('voice.move_down')}
                      >
                        ↓
                      </Button>
                      <Button
                        size="sm"
                        variant="danger-soft"
                        onPress={() => { setDeletingId(voice.id); setError(null); deleteModal.open(); }}
                        isIconOnly
                        aria-label={t('common.delete')}
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

      <AdminMailTemplatesSection />

      {/* Add modal */}
      <Modal.Backdrop isOpen={addModal.isOpen} onOpenChange={addModal.setOpen}>
        <Modal.Container>
          <Modal.Dialog>
          <Modal.CloseTrigger />
          <Modal.Header><Modal.Heading>{t('voice.new_voice')}</Modal.Heading></Modal.Header>
          <Modal.Body>
            <TextField
              className="w-full"
              variant="secondary"
              value={newName}
              onChange={setNewName}
            >
              <Label>{t('common.name')}</Label>
              <Input autoFocus placeholder={t('voice.name_placeholder')} onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }} />
            </TextField>
          </Modal.Body>
          <Modal.Footer>
            <Button variant="tertiary" onPress={addModal.close}>{t('common.cancel')}</Button>
            <Button isPending={adding} onPress={handleAdd} isDisabled={!newName.trim()}>
              {({ isPending }) => <>{isPending && <Spinner color="current" size="sm" />}{t('common.add')}</>}
            </Button>
          </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

      {/* Delete confirm modal */}
      <Modal.Backdrop isOpen={deleteModal.isOpen} onOpenChange={deleteModal.setOpen}>
        <Modal.Container>
          <Modal.Dialog>
          <Modal.CloseTrigger />
          <Modal.Header><Modal.Heading>{t('voice.delete_title')}</Modal.Heading></Modal.Header>
          <Modal.Body>
            <p
              dangerouslySetInnerHTML={{
                __html: t('voice.delete_confirm', { name: deletingVoice?.name ?? '', interpolation: { escapeValue: true } }),
              }}
            />
          </Modal.Body>
          <Modal.Footer>
            <Button variant="tertiary" onPress={deleteModal.close}>{t('common.cancel')}</Button>
            <Button variant="danger" onPress={handleDeleteConfirm}>{t('common.delete')}</Button>
          </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </div>
  );
}
