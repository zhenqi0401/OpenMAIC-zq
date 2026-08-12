'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { Alert, Button, Form } from 'antd';
import {
  AuthClientError,
  login,
  normalizePhoneInput,
  validateAuthField,
  validateLoginValues,
  type AuthFieldErrors,
  type LoginValues,
} from '@/lib/auth/client';
import { AuthField } from './auth-field';
import { PasswordField } from './password-field';

const initialValues: LoginValues = { phone: '', password: '' };

export function LoginForm() {
  const router = useRouter();
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState<AuthFieldErrors>({});
  const [status, setStatus] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function updateField(name: keyof LoginValues, value: string) {
    const nextValue = name === 'phone' ? normalizePhoneInput(value) : value;
    setValues((current) => ({ ...current, [name]: nextValue }));
    setStatus('');
    setErrors((current) =>
      current[name] ? { ...current, [name]: validateAuthField(name, nextValue) } : current,
    );
  }

  function validateOnBlur(name: keyof LoginValues) {
    if (!values[name]) return;
    const nextError = validateAuthField(name, values[name]);
    if (nextError) setErrors((current) => ({ ...current, [name]: nextError }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setStatus('');

    const nextErrors = validateLoginValues(values);
    setErrors(nextErrors);
    const firstInvalid = (['phone', 'password'] as const).find((name) => nextErrors[name]);
    if (firstInvalid) {
      const target = form.elements.namedItem(firstInvalid);
      if (target instanceof HTMLElement) target.focus();
      return;
    }

    setSubmitting(true);
    try {
      await login(values);
      router.replace('/');
      router.refresh();
    } catch (error) {
      const issue =
        error instanceof AuthClientError ? error.issue : { message: '登录失败，请稍后重试' };
      if (issue.field) {
        setErrors((current) => ({ ...current, [issue.field!]: issue.message }));
        requestAnimationFrame(() => {
          const target = form.elements.namedItem(issue.field!);
          if (target instanceof HTMLElement) target.focus();
        });
      } else {
        setStatus(issue.message);
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Form
      component="form"
      className="grid w-full max-w-[440px] flex-1 content-center gap-3.5 self-center max-[900px]:mt-4"
      onSubmitCapture={submit}
      noValidate
      aria-busy={submitting}
    >
      <div>
        <h1 className="mb-1.5 text-3xl leading-tight font-semibold tracking-tight text-foreground">
          欢迎回来
        </h1>
        <p className="text-sm leading-snug text-muted-foreground [@media(max-height:700px)_and_(max-width:900px)]:hidden">
          使用手机号和密码进入学习中心。
        </p>
      </div>

      <fieldset className="grid min-w-0 gap-3" disabled={submitting}>
        <AuthField
          name="phone"
          label="手机号"
          type="tel"
          inputMode="numeric"
          autoComplete="tel"
          maxLength={11}
          placeholder="请输入 11 位手机号"
          value={values.phone}
          error={errors.phone}
          onChange={(event) => updateField('phone', event.target.value)}
          onBlur={() => validateOnBlur('phone')}
        />
        <PasswordField
          name="password"
          label="密码"
          autoComplete="current-password"
          placeholder="请输入密码"
          value={values.password}
          error={errors.password}
          onChange={(event) => updateField('password', event.target.value)}
          onBlur={() => validateOnBlur('password')}
        />
      </fieldset>

      <div className="flex min-h-11 items-center justify-between gap-3 text-xs text-muted-foreground">
        <span>企业员工账号</span>
        <Button
          type="link"
          className="!h-11 !px-1 !text-sm"
          onClick={() => setStatus('请联系企业培训管理员重置账号密码。')}
        >
          无法登录？
        </Button>
      </div>

      <Button
        type="primary"
        htmlType="submit"
        className="mt-0.5 !h-12 rounded-xl !text-sm font-semibold"
        loading={submitting}
      >
        {submitting ? '正在验证账号' : '登录'}
      </Button>
      {status ? (
        <Alert message={status} type="error" showIcon role="status" aria-live="polite" />
      ) : null}
      <p className="text-center text-sm text-muted-foreground">
        首次使用？{' '}
        <Link
          href="/register"
          className="font-semibold text-primary underline-offset-4 hover:underline"
        >
          创建员工账号
        </Link>
      </p>
    </Form>
  );
}
