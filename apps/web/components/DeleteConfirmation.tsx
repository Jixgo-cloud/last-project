'use client';

import { useEffect, useId, useRef, useState } from 'react';

export default function DeleteConfirmation({ title, description, onCancel, onConfirm }: {
  title: string;
  description: string;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const locked = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const titleId = useId();
  const descriptionId = useId();

  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const element = dialog.current;
    element?.showModal();
    return () => { element?.close(); previous?.focus(); };
  }, []);

  const confirm = async () => {
    if (locked.current) return;
    locked.current = true;
    setBusy(true);
    setError('');
    try {
      await onConfirm();
      onCancel();
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : 'ดำเนินการไม่สำเร็จ กรุณาลองใหม่');
    } finally {
      locked.current = false;
      setBusy(false);
    }
  };

  return <dialog ref={dialog} aria-labelledby={titleId} aria-describedby={descriptionId}
    onCancel={event => { event.preventDefault(); if (!locked.current) onCancel(); }}
    className="w-[calc(100%_-_2rem)] max-w-lg rounded-2xl p-6 shadow-xl backdrop:bg-slate-900/50">
    <h2 id={titleId} className="text-lg font-bold text-slate-900">ยืนยันการลบ “{title}”</h2>
    <p id={descriptionId} className="mt-3 text-sm text-slate-600">{description}</p>
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
    <div className="mt-6 flex justify-end gap-3">
      <button autoFocus disabled={busy} onClick={onCancel} className="rounded-lg border px-4 py-2 disabled:opacity-50">ยกเลิก</button>
      <button disabled={busy} onClick={confirm} className="rounded-lg bg-red-700 px-4 py-2 text-white disabled:opacity-50">{busy ? 'กำลังดำเนินการ...' : 'ยืนยันการลบ'}</button>
    </div>
  </dialog>;
}
