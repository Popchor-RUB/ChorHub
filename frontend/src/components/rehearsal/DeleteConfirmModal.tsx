import { useState } from 'react';
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
} from '@heroui/react';
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
        <ModalHeader>Probe löschen</ModalHeader>
        <ModalBody className="pb-2">
          <p>
            Soll die Probe <strong>{rehearsal?.title}</strong> wirklich gelöscht werden?
          </p>
        </ModalBody>
        <ModalFooter>
          <Button variant="flat" onPress={onClose}>
            Abbrechen
          </Button>
          <Button color="danger" isLoading={deleting} onPress={handleDelete}>
            Löschen
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
