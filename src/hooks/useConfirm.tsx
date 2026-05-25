import { useCallback, useState } from "react";
import type { ConfirmOptions } from "../types";

export function useConfirm() {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const [resolver, setResolver] = useState<((value: boolean) => void) | null>(null);

  const confirm = useCallback((nextOptions: ConfirmOptions) => {
    setOptions(nextOptions);
    return new Promise<boolean>((resolve) => {
      setResolver(() => resolve);
    });
  }, []);

  const settle = useCallback(
    (value: boolean) => {
      resolver?.(value);
      setOptions(null);
      setResolver(null);
    },
    [resolver]
  );

  return { options, confirm, settle };
}
