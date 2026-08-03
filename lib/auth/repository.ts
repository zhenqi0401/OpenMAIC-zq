import { createHash } from 'node:crypto';
import { and, eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import type {
  AuthRepository,
  AuthRole,
  AuthUser,
  CreateUserInput,
  InviteCodeRecord,
  AuthTenant,
} from './service';
import { AuthServiceError } from './service';
import {
  courses,
  inviteCodes,
  roles,
  securityAuditLog,
  tenants,
  users,
} from '@/lib/storage/schema';
import { runDbTransaction } from '@/lib/storage/db';

let sqlClient: ReturnType<typeof postgres> | null = null;
let dbClient: ReturnType<typeof drizzle> | null = null;
let repository: AuthRepository | null = null;

function getDatabaseUrl(): string {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required for OpenMAIC enterprise auth');
  }
  return databaseUrl;
}

function getDb() {
  if (!dbClient) {
    sqlClient = postgres(getDatabaseUrl());
    dbClient = drizzle(sqlClient);
  }
  return dbClient;
}

function toAuthRole(role: typeof roles.$inferSelect): AuthRole {
  return {
    id: role.id,
    tenantId: role.tenantId,
    code: role.code,
    name: role.name,
    isAdmin: role.isAdmin,
  };
}

function toAuthUser(user: typeof users.$inferSelect): AuthUser {
  return {
    id: user.id,
    tenantId: user.tenantId,
    phone: user.phone,
    passwordHash: user.passwordHash,
    hostUserId: user.hostUserId,
    roleId: user.roleId,
    status: user.status,
    displayName: user.displayName,
  };
}

function toInviteCode(inviteCode: typeof inviteCodes.$inferSelect): InviteCodeRecord {
  return {
    codeHash: inviteCode.codeHash,
    tenantId: inviteCode.tenantId,
    roleId: inviteCode.roleId,
    enabled: inviteCode.enabled,
    expiresAt: inviteCode.expiresAt,
  };
}

function toAuthTenant(tenant: typeof tenants.$inferSelect): AuthTenant {
  return {
    id: tenant.id,
    companyId: tenant.companyId,
    name: tenant.name,
    type: tenant.type as AuthTenant['type'],
    status: tenant.status as AuthTenant['status'],
  };
}

export class DrizzleAuthRepository implements AuthRepository {
  async findUserByPhone(phone: string): Promise<AuthUser | null> {
    const [user] = await getDb().select().from(users).where(eq(users.phone, phone)).limit(1);
    return user ? toAuthUser(user) : null;
  }

  async findUserByHostUserId(hostUserId: string): Promise<AuthUser | null> {
    const [user] = await getDb()
      .select()
      .from(users)
      .where(eq(users.hostUserId, hostUserId))
      .limit(1);
    return user ? toAuthUser(user) : null;
  }

  async findUserWithRoleById(
    userId: string,
  ): Promise<{ user: AuthUser; role: AuthRole; tenant: AuthTenant } | null> {
    const [record] = await getDb()
      .select({ user: users, role: roles, tenant: tenants })
      .from(users)
      .innerJoin(roles, eq(users.roleId, roles.id))
      .innerJoin(tenants, eq(users.tenantId, tenants.id))
      .where(eq(users.id, userId))
      .limit(1);
    return record
      ? {
          user: toAuthUser(record.user),
          role: toAuthRole(record.role),
          tenant: toAuthTenant(record.tenant),
        }
      : null;
  }

  async findRoleById(roleId: string): Promise<AuthRole | null> {
    const [role] = await getDb().select().from(roles).where(eq(roles.id, roleId)).limit(1);
    return role ? toAuthRole(role) : null;
  }

  async findRoleByCode(code: string): Promise<AuthRole | null> {
    const [role] = await getDb().select().from(roles).where(eq(roles.code, code)).limit(1);
    return role ? toAuthRole(role) : null;
  }

  async findInviteCodeByHash(codeHash: string): Promise<InviteCodeRecord | null> {
    const [inviteCode] = await getDb()
      .select()
      .from(inviteCodes)
      .where(eq(inviteCodes.codeHash, codeHash))
      .limit(1);
    return inviteCode ? toInviteCode(inviteCode) : null;
  }

  async createUser(input: CreateUserInput): Promise<AuthUser> {
    const [user] = await getDb()
      .insert(users)
      .values({
        tenantId: input.tenantId,
        phone: input.phone,
        passwordHash: input.passwordHash,
        hostUserId: input.hostUserId,
        roleId: input.roleId,
        displayName: input.displayName,
      })
      .returning();
    return toAuthUser(user);
  }

  async provisionHostSsoUser(input: {
    hostUserId: string;
    displayName: string;
    phone: string;
    companyId: string;
    companyName: string;
  }): Promise<{ user: AuthUser; role: AuthRole; tenant: AuthTenant }> {
    return runDbTransaction<{ user: AuthUser; role: AuthRole; tenant: AuthTenant }>(async (tx) => {
      let [tenant] = await tx
        .select()
        .from(tenants)
        .where(eq(tenants.companyId, input.companyId))
        .limit(1);
      if (!tenant) {
        [tenant] = await tx
          .insert(tenants)
          .values({ companyId: input.companyId, name: input.companyName, type: 'company' })
          .onConflictDoUpdate({
            target: tenants.companyId,
            set: { updatedAt: new Date() },
          })
          .returning();
      }
      await tx
        .insert(roles)
        .values([
          { tenantId: tenant.id, code: 'admin', name: '企业管理员', isAdmin: true },
          { tenantId: tenant.id, code: 'learner', name: '企业学员', isAdmin: false },
        ])
        .onConflictDoNothing();
      if (tenant.status !== 'active') {
        const error = new Error('TENANT_SUSPENDED');
        error.name = 'TENANT_SUSPENDED';
        throw error;
      }

      const [existing] = await tx
        .select()
        .from(users)
        .where(eq(users.hostUserId, input.hostUserId))
        .for('update')
        .limit(1);
      if (existing && existing.tenantId !== tenant.id) {
        const error = new Error('TENANT_MISMATCH');
        error.name = 'TENANT_MISMATCH';
        throw error;
      }
      const [phoneOwner] = await tx
        .select({ id: users.id })
        .from(users)
        .where(eq(users.phone, input.phone))
        .limit(1);
      if (phoneOwner && phoneOwner.id !== existing?.id) {
        const error = new Error('PHONE_ALREADY_REGISTERED');
        error.name = 'PHONE_ALREADY_REGISTERED';
        throw error;
      }
      const [adminRole] = await tx
        .select()
        .from(roles)
        .where(and(eq(roles.tenantId, tenant.id), eq(roles.code, 'admin'), eq(roles.isAdmin, true)))
        .limit(1);
      if (!adminRole) throw new Error('ADMIN_ROLE_NOT_FOUND');

      let user = existing;
      if (!user) {
        [user] = await tx
          .insert(users)
          .values({
            tenantId: tenant.id,
            hostUserId: input.hostUserId,
            phone: input.phone,
            roleId: adminRole.id,
            displayName: input.displayName,
          })
          .returning();
      } else if (user.displayName !== input.displayName || user.phone !== input.phone) {
        [user] = await tx
          .update(users)
          .set({ displayName: input.displayName, phone: input.phone, updatedAt: new Date() })
          .where(eq(users.id, user.id))
          .returning();
      }
      return { user: toAuthUser(user), role: toAuthRole(adminRole), tenant: toAuthTenant(tenant) };
    }).catch(async (error: unknown) => {
      if (
        error instanceof Error &&
        ['TENANT_MISMATCH', 'TENANT_SUSPENDED', 'PHONE_ALREADY_REGISTERED'].includes(error.name)
      ) {
        if (error.name === 'TENANT_MISMATCH' || error.name === 'TENANT_SUSPENDED') {
          const [tenant] = await getDb()
            .select({ id: tenants.id })
            .from(tenants)
            .where(eq(tenants.companyId, input.companyId))
            .limit(1);
          await getDb()
            .insert(securityAuditLog)
            .values({
              tenantId: tenant?.id ?? null,
              event: `host_sso.${error.name.toLowerCase()}`,
              subjectHash: createHash('sha256').update(input.hostUserId).digest('hex'),
              metadata: {
                companyIdHash: createHash('sha256').update(input.companyId).digest('hex'),
              },
            });
        }
        throw new AuthServiceError(
          error.name as 'TENANT_MISMATCH' | 'TENANT_SUSPENDED' | 'PHONE_ALREADY_REGISTERED',
        );
      }
      throw error;
    });
  }

  async updateUserFromHostSso(
    userId: string,
    input: { displayName: string; phone: string },
  ): Promise<AuthUser | null> {
    const [user] = await getDb()
      .update(users)
      .set({ displayName: input.displayName, phone: input.phone, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user ? toAuthUser(user) : null;
  }

  async listUsersWithRoles(): Promise<Array<{ user: AuthUser; role: AuthRole }>> {
    const records = await getDb()
      .select({ user: users, role: roles })
      .from(users)
      .innerJoin(roles, eq(users.roleId, roles.id));
    return records.map((record) => ({
      user: toAuthUser(record.user),
      role: toAuthRole(record.role),
    }));
  }

  async updateUserRole(userId: string, roleId: string): Promise<AuthUser | null> {
    const [user] = await getDb()
      .update(users)
      .set({ roleId, updatedAt: new Date() })
      .where(eq(users.id, userId))
      .returning();
    return user ? toAuthUser(user) : null;
  }

  async deleteUser(userId: string): Promise<AuthUser | null> {
    return getDb().transaction(async (tx) => {
      await tx
        .update(inviteCodes)
        .set({ createdBy: null })
        .where(eq(inviteCodes.createdBy, userId));
      await tx.update(courses).set({ createdBy: null }).where(eq(courses.createdBy, userId));
      const [user] = await tx.delete(users).where(eq(users.id, userId)).returning();
      return user ? toAuthUser(user) : null;
    });
  }
}

export function getAuthRepository(): AuthRepository {
  if (!repository) repository = new DrizzleAuthRepository();
  return repository;
}
