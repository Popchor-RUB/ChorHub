import { useEffect, useState } from 'react';
import { Button, Label, Modal, TextArea, TextField } from '@heroui/react';
import { DocumentTextIcon } from '@heroicons/react/24/outline';
import { useTranslation } from 'react-i18next';
import { MEMBER_COMMENT_LIMIT } from './memberComment';

type Props = {
  comment: string | null | undefined;
  onSave: (comment: string) => Promise<void>;
};

export function MemberCommentEditor({ comment, onSave }: Props) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  const [draft, setDraft] = useState(comment ?? '');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  useEffect(() => {
    if (!isOpen) setDraft(comment ?? '');
  }, [comment, isOpen]);

  const handleClose = () => {
    setDraft(comment ?? '');
    setSaveError(false);
    setIsOpen(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError(false);
    try {
      await onSave(draft);
      setIsOpen(false);
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Button
        isIconOnly
        size="sm"
        variant={isOpen ? 'primary' : 'tertiary'}
        aria-label={t('member_comment.edit')}
        data-testid="member-comment-toggle"
        onPress={() => {
          setSaveError(false);
          setDraft(comment ?? '');
          setIsOpen(true);
        }}
      >
        <DocumentTextIcon className="h-4 w-4" />
      </Button>
      <Modal.Backdrop isOpen={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
        <Modal.Container size="md">
          <Modal.Dialog>
            <Modal.CloseTrigger />
            <Modal.Header>
              <Modal.Heading>{t('member_comment.edit')}</Modal.Heading>
            </Modal.Header>
            <Modal.Body className="flex flex-col gap-3">
              <TextField className="w-full" value={draft} onChange={setDraft} variant="secondary">
                <Label>{t('member_comment.label')}</Label>
                <TextArea
                  data-testid="member-comment-input"
                  maxLength={MEMBER_COMMENT_LIMIT}
                  rows={5}
                />
              </TextField>
              <span className="text-xs text-muted">{draft.length}/{MEMBER_COMMENT_LIMIT}</span>
              {saveError && <p className="text-sm text-danger" role="alert">{t('member_comment.save_failed')}</p>}
            </Modal.Body>
            <Modal.Footer>
              <Button variant="tertiary" data-testid="member-comment-cancel" isDisabled={saving} onPress={handleClose}>
                {t('member_comment.cancel')}
              </Button>
              <Button isPending={saving} data-testid="member-comment-save" onPress={() => void handleSave()}>
                {t('member_comment.save')}
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </>
  );
}
