import type { SortDescriptor } from '@heroui/react';
import type { MemberOverview } from '../types';

export function sortMembers(
  members: MemberOverview[],
  sortDescriptor: SortDescriptor,
  locale: string,
): MemberOverview[] {
  const collator = new Intl.Collator(locale, { numeric: true, sensitivity: 'base' });

  return [...members].sort((first, second) => {
    let comparison: number;

    switch (sortDescriptor.column) {
      case 'name':
        comparison = collator.compare(first.firstName, second.firstName)
          || collator.compare(first.lastName, second.lastName);
        break;
      case 'email':
        comparison = collator.compare(first.email, second.email);
        break;
      case 'voice':
        comparison = collator.compare(first.choirVoice?.name ?? '', second.choirVoice?.name ?? '');
        break;
      case 'rehearsals':
        comparison = first.attendanceCount - second.attendanceCount;
        break;
      case 'unexcused':
        comparison = first.unexcusedAbsenceCount - second.unexcusedAbsenceCount;
        break;
      default:
        comparison = 0;
    }

    return sortDescriptor.direction === 'descending' ? -comparison : comparison;
  });
}
