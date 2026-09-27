import { DocumentTextIcon } from '@heroicons/react/24/outline';
import { Tooltip } from '@heroui/react';
import { useTranslation } from 'react-i18next';

type Props = {
  comment: string | null | undefined;
};

export function MemberCommentIndicator({ comment }: Props) {
  const { t } = useTranslation();
  if (!comment) return null;

  return (
    <Tooltip delay={0}>
      <Tooltip.Trigger
        aria-label={t('member_comment.indicator_label')}
        data-testid="member-comment-indicator"
        className="inline-flex cursor-help items-center bg-transparent p-0"
      >
        <DocumentTextIcon className="h-3.5 w-3.5 shrink-0 text-warning" aria-hidden="true" />
      </Tooltip.Trigger>
      <Tooltip.Content className="max-w-xs whitespace-pre-wrap break-words">
        <p>{comment}</p>
      </Tooltip.Content>
    </Tooltip>
  );
}
