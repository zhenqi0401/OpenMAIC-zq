'use client';

import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  AdminCard,
  AdminStatusBadge,
  adminInputClassName,
  adminSecondaryButtonClassName,
  adminSelectClassName,
} from '@/components/admin/AdminSurface';
import { AdminEmptyState } from '@/components/admin/AdminEmptyState';
import {
  getInviteCodeView,
  type AdminInviteCode,
  type AdminRole,
  type RoleOption,
} from '@/lib/admin/client';
import {
  getInviteCodeValidationIssue,
  INVITE_CODE_MAX_LENGTH,
  INVITE_CODE_MIN_LENGTH,
  normalizeInviteCode,
  type InviteCodeValidationIssue,
} from '@/lib/auth/invite-code';
import { toast } from 'sonner';
import { AccessDangerDialog } from './AccessUsersTab';

export interface InviteDraft {
  code: string;
  roleId: string;
  enabled: boolean;
  expiresAt: string;
}

function toDatetimeLocal(value: string | Date | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 16);
}

function formatAdminDate(value: string | Date | null | undefined, fallback = '长期有效') {
  if (!value) return fallback;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('zh-CN', { hour12: false });
}

function getInviteCodeValidationMessage(issue: InviteCodeValidationIssue): string {
  if (issue === 'REQUIRED') return '请输入邀请码明文';
  if (issue === 'TOO_SHORT') return `邀请码至少需要 ${INVITE_CODE_MIN_LENGTH} 个字符`;
  return `邀请码不能超过 ${INVITE_CODE_MAX_LENGTH} 个字符`;
}

function InviteStatusBadge({ status }: { status: 'active' | 'disabled' | 'expired' }) {
  const label = status === 'active' ? '启用中' : status === 'disabled' ? '已停用' : '已过期';
  const tone = status === 'active' ? 'success' : status === 'expired' ? 'warning' : 'neutral';
  return <AdminStatusBadge tone={tone}>{label}</AdminStatusBadge>;
}

function InviteForm({
  createMode,
  disabled,
  draft,
  onChange,
  roleOptions,
}: {
  createMode: boolean;
  disabled: boolean;
  draft: InviteDraft;
  onChange: (draft: InviteDraft) => void;
  roleOptions: readonly RoleOption[];
}) {
  return (
    <div className="grid gap-4">
      {createMode ? (
        <label className="grid gap-1.5 text-sm text-[#75665d]">
          <span>邀请码明文</span>
          <Input
            autoComplete="off"
            className={adminInputClassName}
            disabled={disabled}
            maxLength={INVITE_CODE_MAX_LENGTH}
            onChange={(event) =>
              onChange({ ...draft, code: normalizeInviteCode(event.target.value) })
            }
            placeholder="手工输入邀请码明文"
            value={draft.code}
          />
        </label>
      ) : null}
      <label className="grid gap-1.5 text-sm text-[#75665d]">
        <span>绑定角色</span>
        <select
          className={adminSelectClassName}
          disabled={disabled}
          onChange={(event) => onChange({ ...draft, roleId: event.target.value })}
          value={draft.roleId}
        >
          <option value="">请选择角色</option>
          {roleOptions.map((role) => (
            <option key={role.value} value={role.value}>
              {role.label}
            </option>
          ))}
        </select>
      </label>
      <label className="grid gap-1.5 text-sm text-[#75665d]">
        <span>过期时间</span>
        <Input
          className={adminInputClassName}
          disabled={disabled}
          onChange={(event) => onChange({ ...draft, expiresAt: event.target.value })}
          type="datetime-local"
          value={draft.expiresAt}
        />
      </label>
      <label className="inline-flex items-center gap-2 text-sm text-[#75665d]">
        <input
          checked={draft.enabled}
          disabled={disabled}
          onChange={(event) => onChange({ ...draft, enabled: event.target.checked })}
          type="checkbox"
        />
        启用
      </label>
    </div>
  );
}

function InviteSummary({
  inviteCode,
  roles,
}: {
  inviteCode: AdminInviteCode;
  roles: readonly AdminRole[];
}) {
  const view = getInviteCodeView(inviteCode, roles);
  return (
    <>
      <InviteStatusBadge status={view.status} />
      <span className="min-w-0 break-words font-medium text-[#2b211d]">{view.roleLabel}</span>
      <time className="break-words text-sm text-[#75665d]">
        {formatAdminDate(inviteCode.createdAt, '-')}
      </time>
      <time className="break-words text-sm text-[#75665d]">
        {formatAdminDate(inviteCode.expiresAt)}
      </time>
      <span className="text-sm text-[#75665d]">{inviteCode.enabled ? '是' : '否'}</span>
    </>
  );
}

export function AccessInvitesTab({
  creatingInvite,
  deletingInviteCodeId,
  inviteCodes,
  loading,
  onCreateInvite,
  onDeleteInvite,
  onSaveInvite,
  roleOptions,
  roles,
  savingInviteCodeId,
}: {
  creatingInvite: boolean;
  deletingInviteCodeId: string | null;
  inviteCodes: readonly AdminInviteCode[];
  loading: boolean;
  onCreateInvite: (draft: InviteDraft) => Promise<boolean>;
  onDeleteInvite: (inviteCode: AdminInviteCode) => void;
  onSaveInvite: (inviteCodeId: string, draft: Omit<InviteDraft, 'code'>) => Promise<boolean>;
  roleOptions: readonly RoleOption[];
  roles: readonly AdminRole[];
  savingInviteCodeId: string | null;
}) {
  const defaultRoleId = roleOptions[0]?.value ?? '';
  const [createOpen, setCreateOpen] = useState(false);
  const [newInvite, setNewInvite] = useState<InviteDraft>({
    code: '',
    roleId: defaultRoleId,
    enabled: true,
    expiresAt: '',
  });
  const [editingInvite, setEditingInvite] = useState<AdminInviteCode | null>(null);
  const [editDraft, setEditDraft] = useState<InviteDraft>({
    code: '',
    roleId: '',
    enabled: true,
    expiresAt: '',
  });

  const resolvedNewInvite = useMemo(
    () => ({ ...newInvite, roleId: newInvite.roleId || defaultRoleId }),
    [defaultRoleId, newInvite],
  );

  function openEdit(inviteCode: AdminInviteCode) {
    setEditingInvite(inviteCode);
    setEditDraft({
      code: '',
      roleId: inviteCode.roleId,
      enabled: inviteCode.enabled,
      expiresAt: toDatetimeLocal(inviteCode.expiresAt),
    });
  }

  async function submitCreate() {
    const issue = getInviteCodeValidationIssue(resolvedNewInvite.code);
    if (issue) {
      toast.error(getInviteCodeValidationMessage(issue));
      return;
    }
    if (!resolvedNewInvite.roleId) {
      toast.error('绑定角色必填');
      return;
    }
    if (await onCreateInvite(resolvedNewInvite)) {
      setNewInvite({ code: '', roleId: defaultRoleId, enabled: true, expiresAt: '' });
      setCreateOpen(false);
    }
  }

  async function submitEdit() {
    if (!editingInvite || !editDraft.roleId) return;
    if (await onSaveInvite(editingInvite.id, editDraft)) {
      setEditingInvite(null);
    }
  }

  return (
    <AdminCard
      aria-label="邀请码工作区"
      className="min-w-0 space-y-4 p-4"
      data-admin-access-invite-workspace
      data-admin-access-workspace="invites"
      role="tabpanel"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-normal leading-tight tracking-[-0.016em] text-[#2b211d]">
            邀请码
          </h3>
          <p className="mt-1 max-w-[68ch] text-sm leading-6 text-[#75665d]">
            列表只展示状态和绑定信息，不展示邀请码明文；撤销后原邀请码将无法注册。
          </p>
        </div>
        <Dialog onOpenChange={setCreateOpen} open={createOpen}>
          <DialogTrigger asChild>
            <Button className="rounded-[4px] bg-[#c96f54] text-[#fffaf2]" type="button">
              创建邀请码
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-[500px] rounded-[6px] border-[#d8c8b9] bg-[#fffaf2] text-[#2b211d]">
            <DialogHeader>
              <DialogTitle className="text-xl font-normal">创建邀请码</DialogTitle>
              <DialogDescription className="leading-6 text-[#75665d]">
                邀请码明文创建后不会在列表中再次显示，请自行安全保存。当前仍需手工输入明文。
              </DialogDescription>
            </DialogHeader>
            <InviteForm
              createMode
              disabled={creatingInvite}
              draft={resolvedNewInvite}
              onChange={setNewInvite}
              roleOptions={roleOptions}
            />
            <DialogFooter>
              <DialogClose asChild>
                <Button
                  className={adminSecondaryButtonClassName}
                  disabled={creatingInvite}
                  type="button"
                  variant="outline"
                >
                  取消
                </Button>
              </DialogClose>
              <Button
                aria-busy={creatingInvite}
                className="rounded-[4px] bg-[#c96f54] text-[#fffaf2]"
                disabled={creatingInvite}
                onClick={() => void submitCreate()}
                type="button"
              >
                {creatingInvite ? '创建中…' : '确认创建'}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading && inviteCodes.length === 0 ? (
        <AdminEmptyState compact description="正在读取邀请码状态。" title="正在加载邀请码" />
      ) : inviteCodes.length === 0 ? (
        <AdminEmptyState compact title="暂无邀请码" />
      ) : (
        <>
          <div className="hidden xl:block" data-admin-access-invite-table>
            <div className="grid grid-cols-[minmax(90px,0.65fr)_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(48px,0.4fr)_auto] gap-3 border-b border-[#eaded1] pb-2 text-xs font-semibold uppercase tracking-[0.08em] text-[#75665d]">
              <span>状态</span>
              <span>绑定角色</span>
              <span>创建时间</span>
              <span>过期时间</span>
              <span>启用</span>
              <span className="text-right">操作</span>
            </div>
            <div className="divide-y divide-[#eaded1]">
              {inviteCodes.map((inviteCode) => (
                <div
                  className="grid grid-cols-[minmax(90px,0.65fr)_minmax(0,1.1fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(48px,0.4fr)_auto] items-center gap-3 py-3"
                  key={inviteCode.id}
                >
                  <InviteSummary inviteCode={inviteCode} roles={roles} />
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      className={adminSecondaryButtonClassName}
                      disabled={savingInviteCodeId === inviteCode.id}
                      onClick={() => openEdit(inviteCode)}
                      type="button"
                      variant="outline"
                    >
                      编辑
                    </Button>
                    <AccessDangerDialog
                      busy={deletingInviteCodeId === inviteCode.id}
                      confirmLabel="确认撤销"
                      description={`确认撤销绑定到「${getInviteCodeView(inviteCode, roles).roleLabel}」的邀请码？操作不可恢复，原邀请码将无法注册。`}
                      onConfirm={() => onDeleteInvite(inviteCode)}
                      title="撤销邀请码"
                      triggerLabel="撤销"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 xl:hidden" data-admin-access-invite-cards>
            {inviteCodes.map((inviteCode) => {
              const view = getInviteCodeView(inviteCode, roles);
              return (
                <article
                  className="grid min-w-0 gap-3 rounded-[4px] border border-[#eaded1] p-3"
                  key={inviteCode.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-xs text-[#75665d]">绑定角色</div>
                      <div className="mt-1 break-words font-medium">{view.roleLabel}</div>
                    </div>
                    <InviteStatusBadge status={view.status} />
                  </div>
                  <dl className="grid gap-2 text-sm sm:grid-cols-3">
                    <div>
                      <dt className="text-xs text-[#75665d]">创建时间</dt>
                      <dd className="mt-1 break-words">
                        {formatAdminDate(inviteCode.createdAt, '-')}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs text-[#75665d]">过期时间</dt>
                      <dd className="mt-1 break-words">{formatAdminDate(inviteCode.expiresAt)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-[#75665d]">启用状态</dt>
                      <dd className="mt-1">{inviteCode.enabled ? '是' : '否'}</dd>
                    </div>
                  </dl>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      className={adminSecondaryButtonClassName}
                      disabled={savingInviteCodeId === inviteCode.id}
                      onClick={() => openEdit(inviteCode)}
                      type="button"
                      variant="outline"
                    >
                      编辑
                    </Button>
                    <AccessDangerDialog
                      busy={deletingInviteCodeId === inviteCode.id}
                      confirmLabel="确认撤销"
                      description={`确认撤销绑定到「${view.roleLabel}」的邀请码？操作不可恢复，原邀请码将无法注册。`}
                      onConfirm={() => onDeleteInvite(inviteCode)}
                      title="撤销邀请码"
                      triggerLabel="撤销"
                    />
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}

      <Dialog
        onOpenChange={(open) => {
          if (!open) setEditingInvite(null);
        }}
        open={editingInvite !== null}
      >
        <DialogContent className="max-w-[500px] rounded-[6px] border-[#d8c8b9] bg-[#fffaf2] text-[#2b211d]">
          <DialogHeader>
            <DialogTitle className="text-xl font-normal">编辑邀请码</DialogTitle>
            <DialogDescription className="leading-6 text-[#75665d]">
              只更新绑定角色、过期时间和启用状态；邀请码明文不会被读取或展示。
            </DialogDescription>
          </DialogHeader>
          <InviteForm
            createMode={false}
            disabled={Boolean(editingInvite && savingInviteCodeId === editingInvite.id)}
            draft={editDraft}
            onChange={setEditDraft}
            roleOptions={roleOptions}
          />
          <DialogFooter>
            <DialogClose asChild>
              <Button
                className={adminSecondaryButtonClassName}
                disabled={Boolean(editingInvite && savingInviteCodeId === editingInvite.id)}
                type="button"
                variant="outline"
              >
                取消
              </Button>
            </DialogClose>
            <Button
              aria-busy={Boolean(editingInvite && savingInviteCodeId === editingInvite.id)}
              className="rounded-[4px] bg-[#c96f54] text-[#fffaf2]"
              disabled={Boolean(editingInvite && savingInviteCodeId === editingInvite.id)}
              onClick={() => void submitEdit()}
              type="button"
            >
              {editingInvite && savingInviteCodeId === editingInvite.id ? '保存中…' : '保存邀请码'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminCard>
  );
}
