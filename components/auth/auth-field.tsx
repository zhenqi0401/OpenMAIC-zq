'use client';

import type { ComponentProps, ReactNode } from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface AuthFieldProps extends Omit<ComponentProps<typeof Input>, 'id' | 'name'> {
  name: string;
  label: string;
  error?: string;
  action?: ReactNode;
}

export function AuthField({ name, label, error, action, className, ...props }: AuthFieldProps) {
  const errorId = `${name}-error`;
  const input = (
    <Input
      {...props}
      id={name}
      name={name}
      className={`h-12 rounded-xl border-slate-300 bg-background px-3.5 text-base placeholder:text-slate-400 ${
        action ? 'pr-16' : ''
      } ${className ?? ''}`}
      aria-describedby={errorId}
      aria-invalid={Boolean(error)}
    />
  );

  return (
    <div className="grid gap-2" data-field={name}>
      <Label htmlFor={name} className="text-[13px] font-semibold text-foreground">
        {label}
      </Label>
      {action ? (
        <div className="relative">
          {input}
          {action}
        </div>
      ) : (
        input
      )}
      <p id={errorId} className="text-xs leading-snug text-destructive empty:hidden" aria-live="polite">
        {error}
      </p>
    </div>
  );
}
