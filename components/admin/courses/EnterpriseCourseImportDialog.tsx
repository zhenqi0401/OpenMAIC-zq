'use client';

import { useRef, useState } from 'react';
import { CheckCircle2, FileArchive, LoaderCircle, Upload } from 'lucide-react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { EnterpriseCourseImportWarning } from '@/lib/import/enterprise-course-import';
import {
  previewEnterpriseCourseZip,
  type EnterpriseCourseZipPreview,
} from '@/lib/import/enterprise-course-zip';

interface Category {
  id: string;
  name: string;
}

type ImportPhase = 'idle' | 'previewing' | 'validating' | 'uploading' | 'writing' | 'done';

export function EnterpriseCourseImportDialog({
  categories,
  open,
  onOpenChange,
  onImported,
}: {
  categories: readonly Category[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported?: () => Promise<void> | void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<EnterpriseCourseZipPreview | null>(null);
  const [categoryId, setCategoryId] = useState('');
  const [phase, setPhase] = useState<ImportPhase>('idle');
  const [error, setError] = useState<string | null>(null);
  const [warnings, setWarnings] = useState<EnterpriseCourseImportWarning[]>([]);
  const busy = phase !== 'idle' && phase !== 'done';

  function reset() {
    setFile(null);
    setPreview(null);
    setCategoryId('');
    setPhase('idle');
    setError(null);
    setWarnings([]);
    if (inputRef.current) inputRef.current.value = '';
  }

  function close() {
    if (busy) return;
    reset();
    onOpenChange(false);
  }

  async function chooseFile(selected: File | undefined) {
    if (!selected) return;
    setFile(selected);
    setPreview(null);
    setWarnings([]);
    setError(null);
    setPhase('previewing');
    try {
      if (!selected.name.toLowerCase().endsWith('.zip'))
        throw new Error('请选择 .maic.zip 或 .zip 文件');
      const result = await previewEnterpriseCourseZip(await selected.arrayBuffer());
      setPreview(result);
      setPhase('idle');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '课程包预览失败');
      setPhase('idle');
    }
  }

  async function submit() {
    if (!file || !preview || !categoryId || busy) return;
    setError(null);
    setWarnings([]);
    setPhase('validating');
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
    const body = new FormData();
    body.set('file', file);
    body.set('categoryId', categoryId);
    setPhase('uploading');
    try {
      const response = await fetch('/api/admin/courses/import', { method: 'POST', body });
      setPhase('writing');
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
        warnings?: EnterpriseCourseImportWarning[];
      };
      if (!response.ok) throw new Error(data.error || '企业课程导入失败');
      const nextWarnings = Array.isArray(data.warnings) ? data.warnings : [];
      setWarnings(nextWarnings);
      setPhase('done');
      if (nextWarnings.length > 0) {
        toast.warning(
          `课程已保存为草稿，但有 ${nextWarnings.length} 个资源缺失，请修复后再手动发布。`,
        );
      } else {
        toast.success('导入成功，课程已保存为草稿，请在课程管理中检查后手动发布。');
      }
      await onImported?.();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : '企业课程导入失败';
      setError(message);
      setPhase('idle');
      toast.error(message);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (busy) return;
        if (!nextOpen) reset();
        onOpenChange(nextOpen);
      }}
    >
      <DialogContent
        className="max-w-xl"
        showCloseButton={!busy}
        onEscapeKeyDown={(event) => busy && event.preventDefault()}
        onPointerDownOutside={(event) => busy && event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>导入企业课程</DialogTitle>
          <DialogDescription>
            课程会直接写入企业数据库并保存为草稿，必须由管理员检查后手动发布。
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <input
            ref={inputRef}
            className="hidden"
            type="file"
            accept=".maic.zip,.zip,application/zip"
            onChange={(event) => void chooseFile(event.target.files?.[0])}
          />
          <Button
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            type="button"
            variant="outline"
          >
            {phase === 'previewing' ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <FileArchive className="size-4" />
            )}
            {file ? '重新选择课程包' : '选择课程 ZIP'}
          </Button>
          {file ? (
            <div className="rounded-lg border bg-muted/30 p-3 text-sm">
              <div className="font-medium">{preview?.name ?? file.name}</div>
              <div className="mt-1 text-muted-foreground">
                {preview ? `${preview.sceneCount} 个场景 · ` : ''}
                {(file.size / 1024 / 1024).toFixed(2)} MB
              </div>
            </div>
          ) : null}

          <label className="grid gap-2 text-sm font-medium">
            课程分类
            <Select
              disabled={busy || categories.length === 0}
              value={categoryId}
              onValueChange={setCategoryId}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="请选择课程分类" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>
          {categories.length === 0 ? (
            <p className="text-sm text-amber-700">当前没有课程分类，请先到课程管理创建分类。</p>
          ) : null}
          {busy || phase === 'done' ? (
            <ol className="grid grid-cols-3 gap-2 text-xs" aria-label="导入进度">
              {(['校验课程包', '上传资源', '写入数据库'] as const).map((label, index) => {
                const phaseIndex =
                  { validating: 0, uploading: 1, writing: 2, done: 3 }[
                    phase as 'validating' | 'uploading' | 'writing' | 'done'
                  ] ?? -1;
                const complete = phaseIndex > index;
                const active = phaseIndex === index;
                return (
                  <li className="flex items-center gap-1 rounded border p-2" key={label}>
                    {complete ? (
                      <CheckCircle2 className="size-3.5 text-emerald-600" />
                    ) : active ? (
                      <LoaderCircle className="size-3.5 animate-spin" />
                    ) : null}
                    {label}
                  </li>
                );
              })}
            </ol>
          ) : null}
          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
          {warnings.length > 0 ? (
            <div className="max-h-40 overflow-auto rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950">
              <div className="font-medium">缺失资源（{warnings.length}）</div>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {warnings.map((warning, index) => (
                  <li key={`${warning.path}-${index}`}>{warning.message}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button disabled={busy} onClick={close} type="button" variant="outline">
            {phase === 'done' ? '关闭' : '取消'}
          </Button>
          <Button
            disabled={!file || !preview || !categoryId || busy || phase === 'done'}
            onClick={() => void submit()}
            type="button"
          >
            {busy ? (
              <LoaderCircle className="size-4 animate-spin" />
            ) : (
              <Upload className="size-4" />
            )}
            {busy ? '正在导入' : '导入并保存为草稿'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
