import { useState } from 'react';
import {
  Modal,
  Button,
  Spinner,
} from '@heroui/react';
import { useTranslation } from 'react-i18next';
import { rehearsalsApi } from '../../services/api';
import type { Rehearsal } from '../../types';

interface Props {
  rehearsal: Rehearsal | null;
  isOpen: boolean;
  onClose: () => void;
  onDeleted: () => void;
}

export function DeleteConfirmModal({ rehearsal, isOpen, onClose, onDeleted }: Props) {
  const [deleting, setDeleting] = useState(false);
  const { t } = useTranslation();

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
    <Modal.Backdrop isOpen={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <Modal.Container size="sm">
        <Modal.Dialog>
          <Modal.CloseTrigger />
          <Modal.Header><Modal.Heading>{t('rehearsals.delete')}</Modal.Heading></Modal.Header>
          <Modal.Body className="pb-2">
          <p
            dangerouslySetInnerHTML={{
              __html: t('rehearsals.confirm_delete', { title: rehearsal?.title ?? '' }),
            }}
          />
          </Modal.Body>
          <Modal.Footer>
          <Button variant="tertiary" onPress={onClose}>
            {t('common.cancel')}
          </Button>
          <Button variant="danger" isPending={deleting} onPress={handleDelete}>
            {({ isPending }) => <>{isPending && <Spinner color="current" size="sm" />}{t('common.delete')}</>}
          </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal.Backdrop>
  );
}
