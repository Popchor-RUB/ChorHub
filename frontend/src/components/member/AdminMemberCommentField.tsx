import { useEffect, useState } from 'react';
import { Button, Card, Label, TextArea, TextField } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import { MEMBER_COMMENT_LIMIT } from './memberComment';

type Props = {
  comment: string | null;
  onSave: (comment: string) => Promise<string | null>;
};

export function AdminMemberCommentField({ comment, onSave }: Props) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState(comment ?? '');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  useEffect(() => {
    setDraft(comment ?? '');
  }, [comment]);

  const handleSave = async () => {
    if (saving || draft === (comment ?? '')) return;
    setSaving(true);
    setSaveError(false);
    try {
      const savedComment = await onSave(draft);
      setDraft(savedComment ?? '');
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card data-testid="member-detail-comment">
      <Card.Content className="flex flex-col gap-3">
        <TextField className="w-full" value={draft} onChange={setDraft} variant="secondary">
          <Label>{t('member_comment.label')}</Label>
          <TextArea data-testid="member-detail-comment-input" maxLength={MEMBER_COMMENT_LIMIT} rows={5} />
        </TextField>
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted">{draft.length}/{MEMBER_COMMENT_LIMIT}</span>
          <Button
            data-testid="member-detail-comment-save"
            isPending={saving}
            isDisabled={saving || draft === (comment ?? '')}
            onPress={() => void handleSave()}
          >
            {t('member_comment.save')}
          </Button>
        </div>
        {saveError && <p className="text-sm text-danger" role="alert">{t('member_comment.save_failed')}</p>}
      </Card.Content>
    </Card>
  );
}
