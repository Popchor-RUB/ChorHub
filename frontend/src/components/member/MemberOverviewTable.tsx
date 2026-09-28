import { memo } from 'react';
import { MagnifyingGlassIcon } from '@heroicons/react/24/outline';
import { Chip, Table } from '@heroui/react';
import type { SortDescriptor } from '@heroui/react';
import { useTranslation } from 'react-i18next';
import type { MemberOverview } from '../../types';
import { MemberCommentIndicator } from './MemberCommentIndicator';

interface Props {
  members: MemberOverview[];
  sortDescriptor: SortDescriptor;
  onSortChange: (descriptor: SortDescriptor) => void;
  onSelectMember: (member: MemberOverview) => void;
}

export const MemberOverviewTable = memo(function MemberOverviewTable({
  members,
  sortDescriptor,
  onSortChange,
  onSelectMember,
}: Props) {
  const { t } = useTranslation();

  return (
    <Table>
      <Table.ScrollContainer>
        <Table.Content
          aria-label={t('members.table_aria')}
          className="min-w-[700px] [&_tbody_tr]:cursor-pointer"
          sortDescriptor={sortDescriptor}
          onSortChange={onSortChange}
          onRowAction={(key) => {
            const member = members.find((item) => item.id === String(key));
            if (member) onSelectMember(member);
          }}
        >
          <Table.Header>
            <Table.Column allowsSorting isRowHeader id="name">
              {({ sortDirection }) => <Table.SortableColumnHeader sortDirection={sortDirection}>{t('members.col_name')}</Table.SortableColumnHeader>}
            </Table.Column>
            <Table.Column allowsSorting id="email">
              {({ sortDirection }) => <Table.SortableColumnHeader sortDirection={sortDirection}>{t('members.col_email')}</Table.SortableColumnHeader>}
            </Table.Column>
            <Table.Column allowsSorting id="voice">
              {({ sortDirection }) => <Table.SortableColumnHeader sortDirection={sortDirection}>{t('members.col_voice')}</Table.SortableColumnHeader>}
            </Table.Column>
            <Table.Column allowsSorting id="rehearsals">
              {({ sortDirection }) => <Table.SortableColumnHeader sortDirection={sortDirection}>{t('members.col_rehearsals')}</Table.SortableColumnHeader>}
            </Table.Column>
            <Table.Column allowsSorting id="unexcused">
              {({ sortDirection }) => <Table.SortableColumnHeader sortDirection={sortDirection}>{t('members.col_unexcused')}</Table.SortableColumnHeader>}
            </Table.Column>
          </Table.Header>
          <Table.Body renderEmptyState={() => <p className="py-4 text-center text-muted">{t('members.no_members')}</p>}>
            {members.map((member) => (
              <Table.Row key={member.id} id={member.id}>
                <Table.Cell>
                  <span className="inline-flex items-center gap-1 text-accent font-medium">
                    <span>{member.firstName} {member.lastName}</span>
                    <MagnifyingGlassIcon className="h-3.5 w-3.5 opacity-70" aria-hidden="true" />
                    <MemberCommentIndicator comment={member.internalComment} />
                  </span>
                </Table.Cell>
                <Table.Cell className="text-sm text-muted">{member.email}</Table.Cell>
                <Table.Cell>
                  <Chip size="sm" variant="tertiary">
                    {member.choirVoice?.name ?? '—'}
                  </Chip>
                </Table.Cell>
                <Table.Cell>{member.attendanceCount}</Table.Cell>
                <Table.Cell>
                  {member.unexcusedAbsenceCount > 0 ? (
                    <Chip size="sm" className="bg-danger-soft text-danger-soft-foreground" variant="primary">
                      {member.unexcusedAbsenceCount}
                    </Chip>
                  ) : (
                    <Chip size="sm" color="default" variant="primary">
                      {member.unexcusedAbsenceCount}
                    </Chip>
                  )}
                </Table.Cell>
              </Table.Row>
            ))}
          </Table.Body>
        </Table.Content>
      </Table.ScrollContainer>
    </Table>
  );
});
