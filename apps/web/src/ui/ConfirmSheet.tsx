import { useEffect, useRef } from 'react';
import { Button } from './Button.js';

interface ConfirmSheetProps {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}

/** Native dialog provides focus containment, Escape and focus restoration. */
export function ConfirmSheet({ open, title, description, confirmLabel, onCancel, onConfirm }: ConfirmSheetProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const node = dialog.current;
    if (open && !node?.open) node?.showModal();
    if (!open && node?.open) node.close();
    return () => { if (node?.open) node.close(); };
  }, [open]);

  return (
    <dialog ref={dialog} className="studio-sheet" aria-label={title} onCancel={onCancel}>
      <div className="mx-auto mb-5 h-1 w-10 rounded-full bg-edge" aria-hidden="true" />
      <h2 className="text-sous-titre font-semibold tracking-tight">{title}</h2>
      <p className="mt-3 text-lecture leading-relaxed text-ink-2">{description}</p>
      <div className="mt-6 flex flex-col gap-3">
        <Button tone="ghost" full autoFocus onClick={onCancel}>Continuer la soirée</Button>
        <Button tone="danger" full onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </dialog>
  );
}
