import { DocumentTextIcon } from '@heroicons/react/24/outline';
import { Modal, Tooltip } from '@heroui/react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

type Props = {
  comment: string | null | undefined;
};

export function MemberCommentIndicator({ comment }: Props) {
  const { t } = useTranslation();
  const [isOpen, setIsOpen] = useState(false);
  if (!comment) return null;

  return (
    <>
      <Tooltip delay={0}>
        <Tooltip.Trigger
          aria-label={t('member_comment.indicator_label')}
          aria-haspopup="dialog"
          aria-expanded={isOpen}
          data-testid="member-comment-indicator"
          className="inline-flex cursor-pointer items-center justify-center rounded bg-transparent p-2 -m-2"
          onClick={(event) => {
            event.stopPropagation();
            setIsOpen(true);
          }}
        >
          <DocumentTextIcon className="h-3.5 w-3.5 shrink-0 text-warning" aria-hidden="true" />
        </Tooltip.Trigger>
        <Tooltip.Content className="max-w-xs whitespace-pre-wrap break-words">
          <p>{comment}</p>
        </Tooltip.Content>
      </Tooltip>
      {isOpen && (
        <Modal.Backdrop isOpen onOpenChange={setIsOpen}>
          <Modal.Container size="md">
            <Modal.Dialog>
              <Modal.CloseTrigger />
              <Modal.Header>
                <Modal.Heading>{t('member_comment.label')}</Modal.Heading>
              </Modal.Header>
              <Modal.Body>
                <p className="whitespace-pre-wrap break-words">{comment}</p>
              </Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      )}
    </>
  );
}
