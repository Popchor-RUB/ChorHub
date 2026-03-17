import { useState } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
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
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <ModalContent>
        <ModalHeader>{t('rehearsals.delete')}</ModalHeader>
        <ModalBody className="pb-2">
          <p
            dangerouslySetInnerHTML={{
              __html: t('rehearsals.confirm_delete', { title: rehearsal?.title ?? '' }),
            }}
          />
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={onClose}>
            {t('common.cancel')}
          </Button>
          <Button color="danger" isLoading={deleting} onPress={handleDelete}>
            {t('common.delete')}
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
