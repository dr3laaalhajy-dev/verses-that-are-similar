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

function applyWhere(query: any, where: any): any {
  if (!where || typeof where !== 'object') return query;

  for (const [key, value] of Object.entries(where)) {
    if (value === undefined) continue;

    if (key === 'OR' && Array.isArray(value)) {
      const orParts: string[] = [];
      for (const cond of value) {
        if (!cond || typeof cond !== 'object') continue;
        for (const [cKey, cVal] of Object.entries(cond)) {
          if (cVal === undefined) continue;
          if (cVal === null) {
            orParts.push(`${cKey}.is.null`);
          } else if (typeof cVal === 'object' && (cVal as any).equals !== undefined) {
            if ((cVal as any).mode === 'insensitive') {
              orParts.push(`${cKey}.ilike.${(cVal as any).equals}`);
            } else {
              orParts.push(`${cKey}.eq.${(cVal as any).equals}`);
            }
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

    if (key === 'AND' && Array.isArray(value)) {
      for (const cond of value) {
        query = applyWhere(query, cond);
      }
      continue;
    }

    if (value === null) {
      query = query.is(key, null);
    } else if (typeof value === 'object') {
      const v = value as any;
      if (v.in && Array.isArray(v.in)) {
        query = query.in(key, v.in);
      } else if (v.notIn && Array.isArray(v.notIn)) {
        query = query.not(key, 'in', `(${v.notIn.join(',')})`);
      } else if (v.equals !== undefined) {
        if (v.mode === 'insensitive') {
          query = query.ilike(key, v.equals);
        } else {
          query = query.eq(key, v.equals);
        }
      } else if (v.not !== undefined) {
        query = query.neq(key, v.not);
      } else if (v.gte !== undefined) {
        query = query.gte(key, v.gte);
      } else if (v.lte !== undefined) {
        query = query.lte(key, v.lte);
      } else if (v.gt !== undefined) {
        query = query.gt(key, v.gt);
      } else if (v.lt !== undefined) {
        query = query.lt(key, v.lt);
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
    const payload = { ...params?.data };
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
    let updateData = { ...params?.data };
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
    let q = supabaseAdmin.from(this.tableName).update(params?.data || {});
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

  async groupBy(params: any): Promise<any[]> {
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
