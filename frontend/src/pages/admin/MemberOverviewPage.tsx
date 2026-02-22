import { useEffect, useState } from 'react';
import {
  Table,
  TableHeader,
  TableColumn,
  TableBody,
  TableRow,
  TableCell,
  Chip,
  Button,
  Spinner,
} from '@heroui/react';
import { useNavigate } from 'react-router-dom';
import { adminMembersApi } from '../../services/api';
import type { MemberOverview } from '../../types';
import { CHOIR_VOICE_LABELS } from '../../types';

export function MemberOverviewPage() {
  const [members, setMembers] = useState<MemberOverview[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    adminMembersApi.list().then((res) => {
      setMembers(res.data as MemberOverview[]);
      setLoading(false);
    });
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Mitglieder</h1>
        <Button
          color="primary"
          size="sm"
          onPress={() => navigate('/admin/mitglieder/importieren')}
        >
          CSV importieren
        </Button>
      </div>

      {loading ? (
        <div className="flex justify-center pt-8"><Spinner /></div>
      ) : (
        <Table aria-label="Mitgliederübersicht" isStriped>
          <TableHeader>
            <TableColumn>Name</TableColumn>
            <TableColumn>E-Mail</TableColumn>
            <TableColumn>Stimme</TableColumn>
            <TableColumn>Proben</TableColumn>
          </TableHeader>
          <TableBody emptyContent="Keine Mitglieder vorhanden.">
            {members.map((m) => (
              <TableRow key={m.id}>
                <TableCell>{m.lastName}, {m.firstName}</TableCell>
                <TableCell className="text-sm text-default-500">{m.email}</TableCell>
                <TableCell>
                  <Chip size="sm" variant="flat">
                    {CHOIR_VOICE_LABELS[m.choirVoice]}
                  </Chip>
                </TableCell>
                <TableCell>{m.attendanceCount}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}
