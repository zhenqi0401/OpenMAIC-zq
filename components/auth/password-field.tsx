'use client';

import { useState, type ComponentProps } from 'react';

import { AuthField } from './auth-field';

type PasswordFieldProps = Omit<ComponentProps<typeof AuthField>, 'type' | 'action'>;

export function PasswordField(props: PasswordFieldProps) {
  const [revealed, setRevealed] = useState(false);

  return (
    <AuthField
      {...props}
      type={revealed ? 'text' : 'password'}
      action={
        <button
          type="button"
          className="absolute top-1/2 right-2 flex min-h-8 min-w-11 -translate-y-1/2 items-center justify-center rounded-lg px-2 text-[13px] font-semibold text-muted-foreground transition-colors hover:bg-slate-100 hover:text-foreground focus-visible:rounded-md focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:outline-none"
          aria-controls={props.name}
          aria-label={revealed ? '隐藏密码' : '显示密码'}
          onClick={() => setRevealed((current) => !current)}
        >
          {revealed ? '隐藏' : '显示'}
        </button>
      }
    />
  );
}
