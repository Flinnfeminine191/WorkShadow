import { useCallback, useState } from "react";
import type { PromptOptions } from "../types";

export function usePrompt() {
  const [options, setOptions] = useState<PromptOptions | null>(null);
  const [resolver, setResolver] = useState<((value: string | null) => void) | null>(null);

  const prompt = useCallback((next: PromptOptions) => {
    setOptions(next);
    return new Promise<string | null>((resolve) => {
      setResolver(() => resolve);
    });
  }, []);

  const settle = useCallback(
    (value: string | null) => {
      resolver?.(value);
      setOptions(null);
      setResolver(null);
    },
    [resolver]
  );

  return { options, prompt, settle };
}
