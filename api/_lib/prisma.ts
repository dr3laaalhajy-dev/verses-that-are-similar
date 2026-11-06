import { supabaseAdmin } from './supabaseAdmin.js';

// Table mapping from Prisma model name to Supabase table name
const TABLE_MAP: Record<string, string> = {
  player: 'players',
  challenge: 'challenges',
  room: 'rooms',
  systemSetting: 'system_settings',
  appTester: 'app_testers',
  notification: 'notifications',
  deviceToken: 'device_tokens',
  userWird: 'user_wird',
  admin: 'admins',
  adminCode: 'admin_codes',
  friendship: 'friendships',
  reaction: 'reactions',
  whoAmICategory: 'who_am_i_categories',
  whoAmIQuestion: 'who_am_i_questions',
  whoAmIRound: 'who_am_i_rounds',
  whoAmIAnswer: 'who_am_i_answers',
  whoAmISubmission: 'who_am_i_submissions'
};

function resolveTableName(modelName: string): string {
  if (TABLE_MAP[modelName]) return TABLE_MAP[modelName];
  // Convert camelCase to snake_case and pluralize
  const snake = modelName.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
  return snake.endsWith('s') ? snake : `${snake}s`;
}

/**
 * Normalizes values for Supabase queries.
 * Converts Date instances and valid date-like strings to ISO strings.
 */
function normalizeValue(val: any): any {
  if (val === undefined) return undefined;
  if (val === null) return null;
  if (val instanceof Date) {
    return val.toISOString();
  }
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}/.test(val)) {
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      return d.toISOString();
    }
  }
  if (Array.isArray(val)) {
    return val.map(normalizeValue);
  }
  return val;
}

/**
 * Normalizes data payload before insert/update in Supabase.
 * Recursively converts Dates to ISO strings while preserving primitives and increments.
 */
function normalizeData(data: any): any {
  if (!data || typeof data !== 'object') return data;
  if (data instanceof Date) return data.toISOString();
  if (Array.isArray(data)) return data.map(normalizeData);

  const result: any = {};
  for (const [k, v] of Object.entries(data)) {
    if (v instanceof Date) {
      result[k] = v.toISOString();
    } else if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}/.test(v)) {
      const d = new Date(v);
      result[k] = !isNaN(d.getTime()) ? d.toISOString() : v;
    } else if (Array.isArray(v)) {
      result[k] = v.map(normalizeValue);
    } else if (typeof v === 'object' && v !== null && (v as any).increment === undefined) {
      result[k] = normalizeData(v);
    } else {
      result[k] = v;
    }
  }
  return result;
}

function applyWhere(query: any, where: any): any {
  if (!where || typeof where !== 'object') return query;

  for (const [key, rawValue] of Object.entries(where)) {
    if (rawValue === undefined) continue;

    // 1. Prisma Top-Level NOT: { NOT: { id: ... } } or { NOT: [{ ... }] }
    if (key === 'NOT') {
      const notConditions = Array.isArray(rawValue) ? rawValue : [rawValue];
      for (const cond of notConditions) {
        if (!cond || typeof cond !== 'object') continue;
        for (const [cKey, cRawVal] of Object.entries(cond)) {
          if (cRawVal === undefined) continue;
          const cVal = normalizeValue(cRawVal);
          if (cVal === null) {
            query = query.not(cKey, 'is', null);
          } else if (typeof cVal === 'object' && cVal !== null) {
            const cv = cVal as any;
            if (cv.in && Array.isArray(cv.in)) {
              query = query.not(cKey, 'in', `(${cv.in.map(normalizeValue).join(',')})`);
            } else if (cv.equals !== undefined) {
              query = query.neq(cKey, normalizeValue(cv.equals));
            } else if (cv.not !== undefined || cv.NOT !== undefined) {
              query = query.eq(cKey, normalizeValue(cv.not !== undefined ? cv.not : cv.NOT));
            } else {
              query = query.neq(cKey, cVal);
            }
          } else {
            query = query.neq(cKey, cVal);
          }
        }
      }
      continue;
    }

    // 2. Prisma Top-Level OR: { OR: [ ... ] }
    if (key === 'OR' && Array.isArray(rawValue)) {
      const orParts: string[] = [];
      for (const cond of rawValue) {
        if (!cond || typeof cond !== 'object') continue;
        for (const [cKey, cRawVal] of Object.entries(cond)) {
          if (cRawVal === undefined) continue;
          const cVal = normalizeValue(cRawVal);
          if (cVal === null) {
            orParts.push(`${cKey}.is.null`);
          } else if (typeof cVal === 'object' && (cVal as any).equals !== undefined) {
            const eqVal = normalizeValue((cVal as any).equals);
            if ((cVal as any).mode === 'insensitive') {
              orParts.push(`${cKey}.ilike.${eqVal}`);
            } else {
              orParts.push(`${cKey}.eq.${eqVal}`);
            }
          } else if (typeof cVal === 'object' && (cVal as any).contains !== undefined) {
            const pattern = `%${(cVal as any).contains}%`;
            if ((cVal as any).mode === 'insensitive') {
              orParts.push(`${cKey}.ilike.${pattern}`);
            } else {
              orParts.push(`${cKey}.like.${pattern}`);
            }
          } else if (typeof cVal === 'object' && ((cVal as any).not !== undefined || (cVal as any).NOT !== undefined)) {
            const notVal = normalizeValue((cVal as any).not !== undefined ? (cVal as any).not : (cVal as any).NOT);
            orParts.push(`${cKey}.neq.${notVal}`);
          } else if (typeof cVal === 'string' || typeof cVal === 'number' || typeof cVal === 'boolean') {
            orParts.push(`${cKey}.eq.${cVal}`);
          }
        }
      }
      if (orParts.length > 0) {
        query = query.or(orParts.join(','));
      }
      continue;
    }

    // 3. Prisma Top-Level AND: { AND: [ ... ] }
    if (key === 'AND' && Array.isArray(rawValue)) {
      for (const cond of rawValue) {
        query = applyWhere(query, cond);
      }
      continue;
    }

    const value = normalizeValue(rawValue);

    if (value === null) {
      query = query.is(key, null);
    } else if (typeof value === 'object') {
      const v = value as any;
      if (v.in && Array.isArray(v.in)) {
        query = query.in(key, v.in.map(normalizeValue));
      } else if (v.notIn && Array.isArray(v.notIn)) {
        query = query.not(key, 'in', `(${v.notIn.map(normalizeValue).join(',')})`);
      } else if (v.equals !== undefined) {
        const eqVal = normalizeValue(v.equals);
        if (v.mode === 'insensitive') {
          query = query.ilike(key, eqVal);
        } else {
          query = query.eq(key, eqVal);
        }
      } else if (v.contains !== undefined) {
        const pattern = `%${v.contains}%`;
        if (v.mode === 'insensitive') {
          query = query.ilike(key, pattern);
        } else {
          query = query.like(key, pattern);
        }
      } else if (v.startsWith !== undefined) {
        const pattern = `${v.startsWith}%`;
        if (v.mode === 'insensitive') {
          query = query.ilike(key, pattern);
        } else {
          query = query.like(key, pattern);
        }
      } else if (v.endsWith !== undefined) {
        const pattern = `%${v.endsWith}`;
        if (v.mode === 'insensitive') {
          query = query.ilike(key, pattern);
        } else {
          query = query.like(key, pattern);
        }
      } else if (v.not !== undefined || v.NOT !== undefined) {
        const notVal = normalizeValue(v.not !== undefined ? v.not : v.NOT);
        if (typeof notVal === 'object' && notVal !== null && notVal.in && Array.isArray(notVal.in)) {
          query = query.not(key, 'in', `(${notVal.in.map(normalizeValue).join(',')})`);
        } else {
          query = query.neq(key, notVal);
        }
      } else if (v.gte !== undefined) {
        query = query.gte(key, normalizeValue(v.gte));
      } else if (v.lte !== undefined) {
        query = query.lte(key, normalizeValue(v.lte));
      } else if (v.gt !== undefined) {
        query = query.gt(key, normalizeValue(v.gt));
      } else if (v.lt !== undefined) {
        query = query.lt(key, normalizeValue(v.lt));
      } else {
        query = query.eq(key, v);
      }
    } else {
      query = query.eq(key, value);
    }
  }

  return query;
}

class SupabaseModelDelegate {
  private tableName: string;

  constructor(modelName: string) {
    this.tableName = resolveTableName(modelName);
  }

  async findUnique(params: any): Promise<any> {
    let q = supabaseAdmin.from(this.tableName).select('*');
    q = applyWhere(q, params?.where);
    const { data, error } = await q.maybeSingle();
    if (error && error.code !== 'PGRST116') {
      console.warn(`[Supabase ${this.tableName}.findUnique warn]`, error.message);
    }
    return data ?? null;
  }

  async findFirst(params: any): Promise<any> {
    let q = supabaseAdmin.from(this.tableName).select('*');
    q = applyWhere(q, params?.where);
    if (params?.orderBy) {
      if (Array.isArray(params.orderBy)) {
        for (const item of params.orderBy) {
          for (const [col, dir] of Object.entries(item)) {
            q = q.order(col, { ascending: dir === 'asc' });
          }
        }
      } else {
        for (const [col, dir] of Object.entries(params.orderBy)) {
          q = q.order(col, { ascending: dir === 'asc' });
        }
      }
    }
    q = q.limit(1);
    const { data, error } = await q.maybeSingle();
    if (error && error.code !== 'PGRST116') {
      console.warn(`[Supabase ${this.tableName}.findFirst warn]`, error.message);
    }
    return data ?? null;
  }

  async findMany(params: any): Promise<any[]> {
    let q = supabaseAdmin.from(this.tableName).select('*');
    q = applyWhere(q, params?.where);
    if (params?.orderBy) {
      if (Array.isArray(params.orderBy)) {
        for (const item of params.orderBy) {
          for (const [col, dir] of Object.entries(item)) {
            q = q.order(col, { ascending: dir === 'asc' });
          }
        }
      } else {
        for (const [col, dir] of Object.entries(params.orderBy)) {
          q = q.order(col, { ascending: dir === 'asc' });
        }
      }
    }
    if (params?.take) {
      q = q.limit(params.take);
    }
    if (params?.skip) {
      q = q.range(params.skip, params.skip + (params.take || 50) - 1);
    }
    const { data, error } = await q;
    if (error) {
      console.warn(`[Supabase ${this.tableName}.findMany warn]`, error.message);
      return [];
    }
    return data || [];
  }

  async create(params: any): Promise<any> {
    const payload = normalizeData({ ...params?.data });
    delete payload.player1;
    delete payload.player2;
    delete payload.winner;
    delete payload.rounds;
    delete payload.question;

    const { data, error } = await supabaseAdmin.from(this.tableName).insert(payload).select().single();
    if (error) {
      console.error(`[Supabase ${this.tableName}.create error]`, error.message);
      throw error;
    }
    return data;
  }

  async update(params: any): Promise<any> {
    let updateData = normalizeData({ ...params?.data });
    let needsFetch = false;
    for (const [, v] of Object.entries(updateData)) {
      if (v && typeof v === 'object' && (v as any).increment !== undefined) {
        needsFetch = true;
        break;
      }
    }
    if (needsFetch) {
      let q = supabaseAdmin.from(this.tableName).select('*');
      q = applyWhere(q, params?.where);
      const { data: existing } = await q.maybeSingle();
      if (existing) {
        for (const [k, v] of Object.entries(updateData)) {
          if (v && typeof v === 'object' && (v as any).increment !== undefined) {
            updateData[k] = (existing[k] || 0) + Number((v as any).increment);
          }
        }
      }
    }

    delete updateData.player1;
    delete updateData.player2;
    delete updateData.winner;

    let q = supabaseAdmin.from(this.tableName).update(updateData);
    q = applyWhere(q, params?.where);
    const { data, error } = await q.select().maybeSingle();
    if (error) {
      console.error(`[Supabase ${this.tableName}.update error]`, error.message);
      throw error;
    }
    return data;
  }

  async updateMany(params: any): Promise<{ count: number }> {
    const updateData = normalizeData({ ...params?.data });
    let q = supabaseAdmin.from(this.tableName).update(updateData || {});
    q = applyWhere(q, params?.where);
    const { data, error } = await q.select();
    if (error) {
      console.error(`[Supabase ${this.tableName}.updateMany error]`, error.message);
      throw error;
    }
    return { count: data?.length || 0 };
  }

  async delete(params: any): Promise<any> {
    let q = supabaseAdmin.from(this.tableName).delete();
    q = applyWhere(q, params?.where);
    const { data, error } = await q.select().maybeSingle();
    if (error) {
      console.warn(`[Supabase ${this.tableName}.delete warn]`, error.message);
    }
    return data;
  }

  async deleteMany(params: any): Promise<{ count: number }> {
    let q = supabaseAdmin.from(this.tableName).delete();
    q = applyWhere(q, params?.where);
    const { data, error } = await q.select();
    if (error) {
      console.warn(`[Supabase ${this.tableName}.deleteMany warn]`, error.message);
    }
    return { count: data?.length || 0 };
  }

  async upsert(params: any): Promise<any> {
    const existing = await this.findFirst({ where: params?.where });
    if (existing) {
      return await this.update({ where: params?.where, data: params?.update });
    } else {
      return await this.create({ data: { ...params?.create, ...params?.where } });
    }
  }

  async count(params: any): Promise<number> {
    let q = supabaseAdmin.from(this.tableName).select('*', { count: 'exact', head: true });
    q = applyWhere(q, params?.where);
    const { count, error } = await q;
    if (error) {
      console.warn(`[Supabase ${this.tableName}.count warn]`, error.message);
      return 0;
    }
    return count ?? 0;
  }

  async groupBy(_params: any): Promise<any[]> {
    return [];
  }
}

const modelCache = new Map<string, SupabaseModelDelegate>();

function getModelDelegate(prop: string): SupabaseModelDelegate {
  if (!modelCache.has(prop)) {
    modelCache.set(prop, new SupabaseModelDelegate(prop));
  }
  return modelCache.get(prop)!;
}

export const prisma: any = new Proxy({}, {
  get(_target, prop: string) {
    if (prop === '$transaction') {
      return async (arg: any) => {
        if (typeof arg === 'function') {
          return await arg(prisma);
        }
        if (Array.isArray(arg)) {
          return await Promise.all(arg);
        }
        return null;
      };
    }
    if (prop === '$disconnect' || prop === '$connect') {
      return async () => {};
    }
    return getModelDelegate(prop);
  }
});

export default prisma;
