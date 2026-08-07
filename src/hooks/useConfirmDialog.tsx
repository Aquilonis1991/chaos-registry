import { useCallback, useState } from 'react';

export function useConfirmDialog<T>() {
  const [target, setTarget] = useState<T | null>(null);
  const [open, setOpen] = useState(false);

  const openWith = useCallback((t: T) => {
    setTarget(t);
    setOpen(true);
  }, []);

  const close = useCallback(() => {
    setOpen(false);
    setTarget(null);
  }, []);

  return { target, open, openWith, close };
}
