'use client';

import { useState, type ComponentProps } from 'react';

import { AuthField } from './auth-field';
import styles from './auth-page.module.css';

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
          className={styles.inputAction}
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
