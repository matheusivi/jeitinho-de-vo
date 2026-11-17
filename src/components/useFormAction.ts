"use client";

import { startTransition, useActionState, type FormEvent } from "react";

/**
 * Igual ao useActionState, mas envia pelo onSubmit. Com <form action>, o React 19 limpa os campos
 * sempre que a ação termina, inclusive quando ela devolve um erro, e a pessoa perde o que digitou.
 * Aqui os campos só são limpos quando o próprio formulário decide (por exemplo, trocando a key).
 */
export function useFormAction<S>(action: (prev: Awaited<S>, form: FormData) => Promise<S>, initial: Awaited<S>) {
  const [state, dispatch, pending] = useActionState<S, FormData>(action, initial);
  const onSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => dispatch(data));
  };
  return [state, onSubmit, pending] as const;
}
