'use client';

import type { ComponentProps, ReactNode } from 'react';

import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import styles from './auth-page.module.css';

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
      className={`${styles.input} ${className ?? ''}`}
      aria-describedby={errorId}
      aria-invalid={Boolean(error)}
    />
  );

  return (
    <div className={styles.field} data-field={name}>
      <Label htmlFor={name}>{label}</Label>
      {action ? (
        <div className={styles.inputWrap}>
          {input}
          {action}
        </div>
      ) : (
        input
      )}
      <p id={errorId} className={styles.fieldError} aria-live="polite">
        {error}
      </p>
    </div>
  );
}
