import postgres, { type Sql, type TransactionSql } from 'postgres';

type Args = Record<string, string | boolean | string[]> & { _: string[] };
type QuerySql = Sql | TransactionSql;

function parseArgs(argv: string[]): Args {
  const result: Args = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith('--')) {
      result._.push(value);
      continue;
    }
    const key = value.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) result[key] = true;
    else {
      result[key] = next;
      index += 1;
    }
  }
  return result;
}

function required(args: Args, key: string): string {
  const value = args[key];
  if (typeof value !== 'string' || !value.trim()) throw new Error(`--${key} is required`);
  return value.trim();
}

function summary(args: Args, omitted: string[] = []): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(args).filter(
      ([key, value]) => key !== '_' && key !== 'apply' && !omitted.includes(key) && value !== false,
    ),
  );
}

async function auditWrite(
  tx: QuerySql,
  input: {
    operation: string;
    sourceCourseId?: string;
    targetCourseId?: string;
    parameters?: Record<string, unknown>;
  },
) {
  const actor = (process.env.PLATFORM_CLI_ACTOR ?? 'developer-cli').slice(0, 128);
  await tx`
    INSERT INTO platform_audit_log
      (operation, actor, source_course_id, target_course_id, parameters, result)
    VALUES
      (${input.operation}, ${actor}, ${input.sourceCourseId ?? null},
       ${input.targetCourseId ?? null}, ${tx.json((input.parameters ?? {}) as never)}, 'success')
  `;
}

async function promote(sql: Sql, args: Args, apply: boolean) {
  const sourceId = required(args, 'source-course-id');
  const categoryId = required(args, 'platform-category-id');
  const [source] = await sql<
    Array<{
      id: string;
      name: string;
      generation_complete: boolean;
      generation_status: string;
      tenant_type: string;
      company_id: string;
    }>
  >`
    SELECT c.id, c.name, c.generation_complete, c.generation_status,
           t.type AS tenant_type, t.company_id
    FROM courses c
    JOIN tenants t ON t.id = c.tenant_id
    WHERE c.id = ${sourceId} AND c.scope = 'tenant'
  `;
  if (!source) throw new Error('Source course not found');
  if (source.tenant_type !== 'internal' || source.company_id !== 'internal:meishi-ai') {
    throw new Error('Source course must belong to the internal 美视智能 tenant');
  }
  if (!source.generation_complete || source.generation_status !== 'ready') {
    throw new Error('Source course generation is not complete');
  }
  const [category] = await sql<Array<{ id: string; name: string }>>`
    SELECT id, name FROM course_categories
    WHERE id = ${categoryId} AND scope = 'platform' AND tenant_id IS NULL
  `;
  if (!category) throw new Error('Platform category not found');
  const [integrity] = await sql<
    Array<{ scene_count: number; unresolved_media: number; unresolved_audio: number }>
  >`
    SELECT
      (SELECT count(*)::int FROM course_scenes WHERE course_id = ${sourceId}) AS scene_count,
      (SELECT count(*)::int FROM media_files m
       WHERE m.course_id = ${sourceId} AND (m.blob IS NULL OR m.media_id = '')) AS unresolved_media,
      (SELECT count(*)::int FROM course_audio_blobs a
       WHERE a.course_id = ${sourceId} AND (a.blob IS NULL OR a.audio_id = '')) AS unresolved_audio
  `;
  if (!integrity || integrity.scene_count === 0) throw new Error('Source course has no scenes');
  if (integrity.unresolved_media > 0 || integrity.unresolved_audio > 0) {
    throw new Error('Source course contains unresolved media or audio');
  }
  const duplicates = await sql<Array<{ target_course_id: string }>>`
    SELECT target_course_id
    FROM platform_audit_log
    WHERE operation = 'course.promote' AND source_course_id = ${sourceId}
      AND result = 'success' AND target_course_id IS NOT NULL
    ORDER BY created_at DESC
  `;
  if (duplicates.length > 0 && args['allow-duplicate'] !== true) {
    throw new Error(
      `Source course was already promoted to ${duplicates[0].target_course_id}; pass --allow-duplicate for an intentional new version`,
    );
  }
  const plan = {
    operation: 'course.promote',
    sourceCourse: { id: source.id, name: source.name },
    targetCategory: category,
    copied: ['metadata', 'assessmentQuestions', 'scenes', 'outlines', 'media', 'audio'],
    excluded: [
      'progress',
      'assessmentAttempts',
      'examAttempts',
      'danmaku',
      'forum',
      'learnerCount',
    ],
    targetStatus: 'draft',
  };
  if (!apply) return plan;

  const targetId = await sql.begin(async (tx) => {
    const [target] = await tx<Array<{ id: string }>>`
      INSERT INTO courses
        (tenant_id, scope, name, description, category_id, status, visibility_mode,
         stage_snapshot, generation_status, generation_complete, assessment_questions,
         created_by, published_at, created_at, updated_at)
      SELECT NULL, 'platform', name, description, ${categoryId}, 'draft', 'all',
             stage_snapshot, generation_status, generation_complete, assessment_questions,
             NULL, NULL, now(), now()
      FROM courses WHERE id = ${sourceId}
      RETURNING id
    `;
    await tx`
      INSERT INTO course_scenes
        (tenant_id, course_id, scene_key, type, title, scene_order, scene_data, content,
         actions, whiteboards, created_at, updated_at)
      SELECT NULL, ${target.id}, scene_key, type, title, scene_order, scene_data, content,
             actions, whiteboards, now(), now()
      FROM course_scenes WHERE course_id = ${sourceId}
    `;
    await tx`
      INSERT INTO course_outlines
        (tenant_id, course_id, outline, generation_status, generation_complete, created_at, updated_at)
      SELECT NULL, ${target.id}, outline, generation_status, generation_complete, now(), now()
      FROM course_outlines WHERE course_id = ${sourceId}
    `;
    await tx`
      INSERT INTO media_files
        (tenant_id, course_id, scene_id, scene_key, media_id, media_type, mime_type,
         size_bytes, prompt, params, blob, poster_blob, created_at, updated_at)
      SELECT NULL, ${target.id}, target_scene.id, source.scene_key, source.media_id,
             source.media_type, source.mime_type, source.size_bytes, source.prompt,
             source.params, source.blob, source.poster_blob, now(), now()
      FROM media_files source
      LEFT JOIN course_scenes old_scene ON old_scene.id = source.scene_id
      LEFT JOIN course_scenes target_scene
        ON target_scene.course_id = ${target.id}
       AND target_scene.scene_key = COALESCE(source.scene_key, old_scene.scene_key)
      WHERE source.course_id = ${sourceId}
    `;
    await tx`
      INSERT INTO course_audio_blobs
        (tenant_id, course_id, scene_key, audio_id, mime_type, size_bytes, text, voice, blob, created_at)
      SELECT NULL, ${target.id}, scene_key, audio_id, mime_type, size_bytes, text, voice, blob, now()
      FROM course_audio_blobs WHERE course_id = ${sourceId}
    `;
    await auditWrite(tx, {
      operation: 'course.promote',
      sourceCourseId: sourceId,
      targetCourseId: target.id,
      parameters: {
        platformCategoryId: categoryId,
        allowDuplicate: args['allow-duplicate'] === true,
      },
    });
    return target.id;
  });
  return { ...plan, applied: true, targetCourseId: targetId };
}

async function mutatePlatformCourse(sql: Sql, args: Args, command: string, apply: boolean) {
  const courseId = required(args, 'course-id');
  const [course] = await sql<Array<{ id: string; name: string; status: string }>>`
    SELECT id, name, status FROM courses
    WHERE id = ${courseId} AND scope = 'platform' AND tenant_id IS NULL
  `;
  if (!course) throw new Error('Platform course not found');
  const parameters = summary(args);
  const plan = { operation: `course.${command}`, course, parameters };
  if (!apply) return plan;
  await sql.begin(async (tx) => {
    if (command === 'update') {
      const name = typeof args.name === 'string' ? args.name.trim() : undefined;
      const description =
        typeof args.description === 'string' ? args.description.trim() : undefined;
      if (!name && description === undefined)
        throw new Error('--name or --description is required');
      await tx`
        UPDATE courses SET
          name = COALESCE(${name ?? null}, name),
          description = COALESCE(${description ?? null}, description), updated_at = now()
        WHERE id = ${courseId} AND scope = 'platform'
      `;
    } else if (command === 'publish') {
      await tx`DELETE FROM course_visibility_roles WHERE course_id = ${courseId}`;
      await tx`
        UPDATE courses SET status = 'published', visibility_mode = 'all',
          published_at = now(), updated_at = now()
        WHERE id = ${courseId} AND scope = 'platform'
      `;
    } else if (command === 'archive') {
      await tx`
        UPDATE courses SET status = 'archived', updated_at = now()
        WHERE id = ${courseId} AND scope = 'platform'
      `;
    } else throw new Error(`Unsupported course command: ${command}`);
    await auditWrite(tx, { operation: `course.${command}`, targetCourseId: courseId, parameters });
  });
  return { ...plan, applied: true };
}

async function category(sql: Sql, args: Args, command: string, apply: boolean) {
  if (command === 'list') {
    return sql`SELECT id, name, sort_order, created_at, updated_at FROM course_categories WHERE scope = 'platform' ORDER BY sort_order, name`;
  }
  if (command === 'create') {
    const name = required(args, 'name');
    const plan = { operation: 'category.create', name };
    if (!apply) return plan;
    const result = await sql.begin(async (tx) => {
      const [created] = await tx<Array<{ id: string; name: string }>>`
        INSERT INTO course_categories (tenant_id, scope, name, sort_order)
        VALUES (NULL, 'platform', ${name}, 0) RETURNING id, name
      `;
      await auditWrite(tx, {
        operation: 'category.create',
        parameters: { categoryId: created.id, name },
      });
      return created;
    });
    return { ...plan, applied: true, category: result };
  }
  const categoryId = required(args, 'category-id');
  const name = required(args, 'name');
  const [existing] = await sql<Array<{ id: string; name: string }>>`
    SELECT id, name FROM course_categories WHERE id = ${categoryId} AND scope = 'platform'
  `;
  if (!existing) throw new Error('Platform category not found');
  const plan = { operation: 'category.update', category: existing, name };
  if (!apply) return plan;
  await sql.begin(async (tx) => {
    await tx`UPDATE course_categories SET name = ${name}, updated_at = now() WHERE id = ${categoryId} AND scope = 'platform'`;
    await auditWrite(tx, { operation: 'category.update', parameters: { categoryId, name } });
  });
  return { ...plan, applied: true };
}

async function audit(sql: Sql) {
  const [issues] = await sql<
    Array<{
      users_without_tenant: number;
      user_role_mismatch: number;
      course_category_mismatch: number;
      visibility_role_mismatch: number;
      child_tenant_mismatch: number;
    }>
  >`
    SELECT
      (SELECT count(*)::int FROM users WHERE tenant_id IS NULL) AS users_without_tenant,
      (SELECT count(*)::int FROM users u JOIN roles r ON r.id = u.role_id WHERE u.tenant_id IS DISTINCT FROM r.tenant_id) AS user_role_mismatch,
      (SELECT count(*)::int FROM courses c JOIN course_categories cc ON cc.id = c.category_id WHERE c.tenant_id IS DISTINCT FROM cc.tenant_id OR c.scope IS DISTINCT FROM cc.scope) AS course_category_mismatch,
      (SELECT count(*)::int FROM course_visibility_roles cv JOIN courses c ON c.id = cv.course_id JOIN roles r ON r.id = cv.role_id WHERE c.scope = 'platform' OR c.tenant_id IS DISTINCT FROM r.tenant_id) AS visibility_role_mismatch,
      ((SELECT count(*) FROM course_scenes s JOIN courses c ON c.id = s.course_id WHERE s.tenant_id IS DISTINCT FROM c.tenant_id)
       + (SELECT count(*) FROM course_outlines o JOIN courses c ON c.id = o.course_id WHERE o.tenant_id IS DISTINCT FROM c.tenant_id)
       + (SELECT count(*) FROM course_audio_blobs a JOIN courses c ON c.id = a.course_id WHERE a.tenant_id IS DISTINCT FROM c.tenant_id))::int AS child_tenant_mismatch
  `;
  const ok = Object.values(issues).every((value) => value === 0);
  if (!ok) process.exitCode = 2;
  return { ok, issues };
}

async function moderateCommunity(sql: Sql, args: Args, apply: boolean) {
  const type = required(args, 'type');
  const id = required(args, 'id');
  const action = required(args, 'action');
  if (!['danmaku', 'post', 'reply'].includes(type)) {
    throw new Error('--type must be danmaku, post or reply');
  }
  if (!['hide', 'restore', 'delete'].includes(action)) {
    throw new Error('--action must be hide, restore or delete');
  }
  const status =
    action === 'hide' ? 'hidden' : action === 'restore' ? 'visible' : 'deleted_by_admin';
  const table =
    type === 'danmaku' ? 'course_danmaku' : type === 'post' ? 'forum_posts' : 'forum_replies';
  const rows = await sql.unsafe<Array<{ id: string }>>(
    `SELECT id FROM ${table} WHERE id = $1::uuid`,
    [id],
  );
  if (!rows[0]) throw new Error('Community content not found');
  const plan = { operation: 'community.moderate', type, id, action, status };
  if (!apply) return plan;
  await sql.begin(async (tx) => {
    await tx.unsafe(
      `UPDATE ${table} SET status = $1, deleted_at = CASE WHEN $1 = 'deleted_by_admin' THEN now() ELSE NULL END, updated_at = now() WHERE id = $2::uuid`,
      [status, id],
    );
    await auditWrite(tx, {
      operation: 'community.moderate',
      parameters: { type, id, action },
    });
  });
  return { ...plan, applied: true };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const namespace = args._[0];
  const command = args._[1];
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  if (!namespace || !command)
    throw new Error('Usage: platform-content <course|category|community> <command> [options]');
  const sql = postgres(databaseUrl, { max: 1 });
  try {
    const apply = args.apply === true;
    const result =
      namespace === 'course' && command === 'promote'
        ? await promote(sql, args, apply)
        : namespace === 'course' && command === 'audit'
          ? await audit(sql)
          : namespace === 'course'
            ? await mutatePlatformCourse(sql, args, command, apply)
            : namespace === 'category'
              ? await category(sql, args, command, apply)
              : namespace === 'community' && command === 'moderate'
                ? await moderateCommunity(sql, args, apply)
                : (() => {
                    throw new Error(`Unsupported namespace: ${namespace}`);
                  })();
    process.stdout.write(`${JSON.stringify({ dryRun: !apply, result }, null, 2)}\n`);
  } finally {
    await sql.end();
  }
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
