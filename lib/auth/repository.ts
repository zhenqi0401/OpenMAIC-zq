import { eq } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import type {
  AuthRepository,
  AuthRole,
  AuthUser,
  CreateUserInput,
  InviteCodeRecord,
} from './service';
import { courses, inviteCodes, roles, users } from '@/lib/storage/schema';

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
    code: role.code,
    name: role.name,
    isAdmin: role.isAdmin,
  };
}

function toAuthUser(user: typeof users.$inferSelect): AuthUser {
  return {
    id: user.id,
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
    roleId: inviteCode.roleId,
    enabled: inviteCode.enabled,
    expiresAt: inviteCode.expiresAt,
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

  async findUserWithRoleById(userId: string): Promise<{ user: AuthUser; role: AuthRole } | null> {
    const [record] = await getDb()
      .select({ user: users, role: roles })
      .from(users)
      .innerJoin(roles, eq(users.roleId, roles.id))
      .where(eq(users.id, userId))
      .limit(1);
    return record ? { user: toAuthUser(record.user), role: toAuthRole(record.role) } : null;
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
        phone: input.phone,
        passwordHash: input.passwordHash,
        hostUserId: input.hostUserId,
        roleId: input.roleId,
        displayName: input.displayName,
      })
      .returning();
    return toAuthUser(user);
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
