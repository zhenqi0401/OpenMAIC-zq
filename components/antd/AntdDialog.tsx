'use client';

import * as React from 'react';
import { Modal } from 'antd';
import { Slot } from 'radix-ui';

import { cn } from '@/lib/utils';

interface DialogContextValue {
  modal: boolean;
  open: boolean;
  setOpen: (open: boolean) => void;
}

const DialogContext = React.createContext<DialogContextValue | null>(null);

function useDialogContext() {
  const context = React.useContext(DialogContext);
  if (!context) throw new Error('Dialog components must be rendered inside Dialog');
  return context;
}

export function Dialog({
  children,
  defaultOpen = false,
  modal = true,
  onOpenChange,
  open,
}: {
  children: React.ReactNode;
  defaultOpen?: boolean;
  modal?: boolean;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
}) {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen);
  const controlled = open !== undefined;
  const actualOpen = controlled ? open : internalOpen;
  const setOpen = React.useCallback(
    (nextOpen: boolean) => {
      if (!controlled) setInternalOpen(nextOpen);
      onOpenChange?.(nextOpen);
    },
    [controlled, onOpenChange],
  );
  const value = React.useMemo(
    () => ({ modal, open: actualOpen, setOpen }),
    [actualOpen, modal, setOpen],
  );
  return <DialogContext.Provider value={value}>{children}</DialogContext.Provider>;
}

export function DialogTrigger({
  asChild = false,
  children,
  onClick,
  ...props
}: React.ComponentProps<'button'> & { asChild?: boolean }) {
  const { setOpen } = useDialogContext();
  const Comp = asChild ? Slot.Root : 'button';
  return (
    <Comp
      {...props}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) setOpen(true);
      }}
    >
      {children}
    </Comp>
  );
}

export function DialogClose({
  asChild = false,
  children,
  onClick,
  ...props
}: React.ComponentProps<'button'> & { asChild?: boolean }) {
  const { setOpen } = useDialogContext();
  const Comp = asChild ? Slot.Root : 'button';
  return (
    <Comp
      {...props}
      onClick={(event) => {
        onClick?.(event);
        if (!event.defaultPrevented) setOpen(false);
      }}
    >
      {children}
    </Comp>
  );
}

type PreventableEvent = { preventDefault: () => void };

/**
 * 剥离 shadcn 视觉类，避免叠加到 antd Modal 容器上产生黑边、双阴影、
 * 意外背景与圆角错位。只保留布局/间距类（max-w / max-h / overflow / p-*）。
 */
function sanitizeDialogClassName(className?: string): string | undefined {
  if (!className) return undefined;
  const kept = className
    .split(/\s+/)
    .filter((token) => !/^(border|shadow|rounded|bg-|text-|ring|outline|divide)/.test(token));
  return kept.length ? kept.join(' ') : undefined;
}

export interface DialogContentProps extends Omit<React.ComponentProps<'div'>, 'title'> {
  showCloseButton?: boolean;
  onEscapeKeyDown?: (event: PreventableEvent) => void;
  onOpenAutoFocus?: (event: PreventableEvent) => void;
  onPointerDownOutside?: (event: PreventableEvent) => void;
}

export const DialogContent = React.forwardRef<HTMLDivElement, DialogContentProps>(
  function DialogContent(
    {
      children,
      className,
      onEscapeKeyDown,
      onOpenAutoFocus,
      onPointerDownOutside,
      showCloseButton = true,
      ...props
    },
    ref,
  ) {
    const { modal, open, setOpen } = useDialogContext();
    return (
      <Modal
        centered
        closable={showCloseButton}
        destroyOnHidden
        footer={null}
        keyboard={!onEscapeKeyDown}
        mask={modal ? { closable: !onPointerDownOutside } : false}
        open={open}
        width="min(92vw, 720px)"
        className={cn('yuanwo-antd-dialog', sanitizeDialogClassName(className))}
        afterOpenChange={(nextOpen) => {
          if (!nextOpen || !onOpenAutoFocus) return;
          onOpenAutoFocus({ preventDefault: () => undefined });
        }}
        onCancel={() => setOpen(false)}
      >
        <div {...props} ref={ref}>
          {children}
        </div>
      </Modal>
    );
  },
);

export function DialogHeader({ className, ...props }: React.ComponentProps<'div'>) {
  return <div className={cn('mb-5 flex flex-col gap-2', className)} {...props} />;
}

export function DialogFooter({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)}
      {...props}
    />
  );
}

export function DialogTitle({ className, ...props }: React.ComponentProps<'h2'>) {
  return <h2 className={cn('text-lg font-semibold leading-7', className)} {...props} />;
}

export function DialogDescription({ className, ...props }: React.ComponentProps<'p'>) {
  return <p className={cn('text-sm text-muted-foreground', className)} {...props} />;
}

export function DialogPortal({ children }: { children?: React.ReactNode }) {
  return <>{children}</>;
}

export function DialogOverlay() {
  return null;
}
