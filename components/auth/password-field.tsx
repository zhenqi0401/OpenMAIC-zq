'use client';

import type { ComponentProps } from 'react';
import { Input as AntInput } from 'antd';
import { Label } from '@/components/ui/label';

import { AuthField } from './auth-field';

type PasswordFieldProps = Omit<ComponentProps<typeof AuthField>, 'type' | 'action'>;

export function PasswordField(props: PasswordFieldProps) {
  const { name, label, error, className, ...inputProps } = props;
  const errorId = `${name}-error`;
  return (
    <div className="grid gap-2" data-field={name}>
      <Label htmlFor={name} className="text-[13px] font-semibold text-foreground">
        {label}
      </Label>
      <AntInput.Password
        {...inputProps}
        id={name}
        name={name}
        className={`h-12 rounded-xl border-slate-300 bg-background px-3.5 text-base placeholder:text-slate-400 ${className ?? ''}`}
        aria-describedby={errorId}
        aria-invalid={Boolean(error)}
        status={error ? 'error' : undefined}
        visibilityToggle
      />
      <p
        id={errorId}
        className="text-xs leading-snug text-destructive empty:hidden"
        aria-live="polite"
      >
        {error}
      </p>
    </div>
  );
}
