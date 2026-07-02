import { createHash, createHmac, timingSafeEqual } from 'crypto';
import type { SessionIdentity } from './types';
import { hashPassword, verifyPassword } from '@/lib/security/password';

export interface AuthRole {
  id: string;
  code: string;
  name: string;
  isAdmin: boolean;
}

export interface AuthUser {
  id: string;
  phone: string | null;
  passwordHash: string | null;
  hostUserId: string | null;
  roleId: string;
  status: string;
  displayName: string;
}

export interface InviteCodeRecord {
  codeHash: string;
  roleId: string;
  enabled: boolean;
  expiresAt: Date | null;
}

export interface CreateUserInput {
  phone?: string | null;
  passwordHash?: string | null;
  hostUserId?: string | null;
  roleId: string;
  displayName: string;
}

export interface AuthRepository {
  findUserByPhone(phone: string): Promise<AuthUser | null>;
  findUserByHostUserId(hostUserId: string): Promise<AuthUser | null>;
  findUserWithRoleById(userId: string): Promise<{ user: AuthUser; role: AuthRole } | null>;
  findRoleById(roleId: string): Promise<AuthRole | null>;
  findRoleByCode(code: string): Promise<AuthRole | null>;
  findInviteCodeByHash(codeHash: string): Promise<InviteCodeRecord | null>;
  createUser(input: CreateUserInput): Promise<AuthUser>;
  listUsersWithRoles(): Promise<Array<{ user: AuthUser; role: AuthRole }>>;
  updateUserRole(userId: string, roleId: string): Promise<AuthUser | null>;
}

export type AuthServiceErrorCode =
  | 'INVALID_PHONE'
  | 'WEAK_PASSWORD'
  | 'PHONE_ALREADY_REGISTERED'
  | 'INVALID_INVITE_CODE'
  | 'INVITE_CODE_DISABLED'
  | 'INVITE_CODE_EXPIRED'
  | 'INVITE_ROLE_NOT_FOUND'
  | 'INVITE_ROLE_NOT_ALLOWED'
  | 'INVALID_CREDENTIALS'
  | 'USER_DISABLED'
  | 'ADMIN_ROLE_NOT_FOUND'
  | 'USER_NOT_FOUND'
  | 'ROLE_NOT_FOUND';

export class AuthServiceError extends Error {
  constructor(public readonly code: AuthServiceErrorCode) {
    super(code);
    this.name = 'AuthServiceError';
  }
}

export interface AuthResult {
  user: AuthUser;
  role: AuthRole;
  identity: SessionIdentity;
}

export interface PublicUser {
  id: string;
  phone: string | null;
  hostUserId: string | null;
  role: AuthRole;
  status: string;
  displayName: string;
}

function normalizePhone(phone: string): string {
  return phone.trim();
}

function assertValidPhone(phone: string): void {
  if (!/^1\d{10}$/.test(phone)) {
    throw new AuthServiceError('INVALID_PHONE');
  }
}

function assertStrongEnoughPassword(password: string): void {
  if (password.length < 8) {
    throw new AuthServiceError('WEAK_PASSWORD');
  }
}

export function hashInviteCode(code: string): string {
  return `sha256$${createHash('sha256').update(code.trim().toUpperCase()).digest('hex')}`;
}

function identityFrom(user: AuthUser, role: AuthRole, authSource: SessionIdentity['authSource']) {
  return {
    userId: user.id,
    roleId: role.id,
    roleCode: role.code,
    isAdmin: role.isAdmin,
    authSource,
  } satisfies SessionIdentity;
}

function toPublicUser({ user, role }: { user: AuthUser; role: AuthRole }): PublicUser {
  return {
    id: user.id,
    phone: user.phone,
    hostUserId: user.hostUserId,
    role,
    status: user.status,
    displayName: user.displayName,
  };
}

function signaturesMatch(actual: string, expected: string): boolean {
  const actualBuffer = Buffer.from(actual, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  return (
    actualBuffer.length === expectedBuffer.length && timingSafeEqual(actualBuffer, expectedBuffer)
  );
}

function signHostSso(hostUserId: string, secret: string): string {
  return createHmac('sha256', secret).update(hostUserId).digest('hex');
}

export const verifyHostSsoSignature: {
  (hostUserId: string, signature: string | null | undefined, secret: string): boolean;
  sign: typeof signHostSso;
} = Object.assign(
  (hostUserId: string, signature: string | null | undefined, secret: string): boolean => {
    if (!signature || !secret) return false;
    const expected = signHostSso(hostUserId, secret);
    return /^[a-f0-9]+$/i.test(signature) && signaturesMatch(signature, expected);
  },
  { sign: signHostSso },
);

export function createAuthService(repository: AuthRepository) {
  async function getUserRole(user: AuthUser): Promise<AuthRole> {
    const role = await repository.findRoleById(user.roleId);
    if (!role) throw new AuthServiceError('ROLE_NOT_FOUND');
    return role;
  }

  return {
    async registerWithPassword(input: {
      phone: string;
      password: string;
      inviteCode: string;
    }): Promise<AuthResult> {
      const phone = normalizePhone(input.phone);
      assertValidPhone(phone);
      assertStrongEnoughPassword(input.password);

      const existing = await repository.findUserByPhone(phone);
      if (existing) throw new AuthServiceError('PHONE_ALREADY_REGISTERED');

      const inviteCode = await repository.findInviteCodeByHash(hashInviteCode(input.inviteCode));
      if (!inviteCode) throw new AuthServiceError('INVALID_INVITE_CODE');
      if (!inviteCode.enabled) throw new AuthServiceError('INVITE_CODE_DISABLED');
      if (inviteCode.expiresAt && inviteCode.expiresAt.getTime() <= Date.now()) {
        throw new AuthServiceError('INVITE_CODE_EXPIRED');
      }

      const role = await repository.findRoleById(inviteCode.roleId);
      if (!role) throw new AuthServiceError('INVITE_ROLE_NOT_FOUND');
      if (role.isAdmin) throw new AuthServiceError('INVITE_ROLE_NOT_ALLOWED');

      const user = await repository.createUser({
        phone,
        passwordHash: await hashPassword(input.password),
        roleId: role.id,
        displayName: phone,
      });

      return { user, role, identity: identityFrom(user, role, 'password') };
    },

    async loginWithPassword(input: { phone: string; password: string }): Promise<AuthResult> {
      const phone = normalizePhone(input.phone);
      const user = await repository.findUserByPhone(phone);
      if (!user?.passwordHash) throw new AuthServiceError('INVALID_CREDENTIALS');
      if (user.status !== 'active') throw new AuthServiceError('USER_DISABLED');
      if (!(await verifyPassword(input.password, user.passwordHash))) {
        throw new AuthServiceError('INVALID_CREDENTIALS');
      }

      const role = await getUserRole(user);
      return { user, role, identity: identityFrom(user, role, 'password') };
    },

    async loginWithHostSso(input: { hostUserId: string }): Promise<AuthResult> {
      const hostUserId = input.hostUserId.trim();
      let user = await repository.findUserByHostUserId(hostUserId);
      const role = user ? await getUserRole(user) : await repository.findRoleByCode('admin');
      if (!role) throw new AuthServiceError('ADMIN_ROLE_NOT_FOUND');

      if (!user) {
        user = await repository.createUser({
          hostUserId,
          roleId: role.id,
          displayName: `Host admin ${hostUserId}`,
        });
      }

      if (user.status !== 'active') throw new AuthServiceError('USER_DISABLED');

      return { user, role, identity: identityFrom(user, role, 'host-sso') };
    },

    async getSessionUser(userId: string): Promise<AuthResult> {
      const record = await repository.findUserWithRoleById(userId);
      if (!record) throw new AuthServiceError('USER_NOT_FOUND');
      if (record.user.status !== 'active') throw new AuthServiceError('USER_DISABLED');
      return {
        user: record.user,
        role: record.role,
        identity: identityFrom(record.user, record.role, 'password'),
      };
    },

    async listUsers(): Promise<PublicUser[]> {
      const records = await repository.listUsersWithRoles();
      return records.map(toPublicUser);
    },

    async updateUserRole(input: { userId: string; roleId: string }): Promise<AuthResult> {
      const role = await repository.findRoleById(input.roleId);
      if (!role) throw new AuthServiceError('ROLE_NOT_FOUND');
      const user = await repository.updateUserRole(input.userId, role.id);
      if (!user) throw new AuthServiceError('USER_NOT_FOUND');
      return { user, role, identity: identityFrom(user, role, 'password') };
    },
  };
}
