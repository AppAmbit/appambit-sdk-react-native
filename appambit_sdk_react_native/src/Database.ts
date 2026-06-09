import NativeAppambitDatabase from './NativeAppambitDatabase';

export type DbResult = {
  columns: string[];
  rows: any[][];
  rowsRead: number;
  rowsWritten: number;
  error?: string;
};

export type DbRow = Record<string, any>;

export type DbStatementInput = {
  sql: string;
  params?: any[];
};

const ALLOWED_DB_OPERATORS = new Set([
  '=', '!=', '<>', '>', '>=', '<', '<=',
  'LIKE', 'NOT LIKE', 'IS', 'IS NOT',
]);

function quoteDbIdentifier(name: string): string {
  return '"' + name.replace(/"/g, '""') + '"';
}

export class DbQueryBuilder {
  private _table: string;
  private _selectedColumns: string[] = [];
  private _whereConditions: string[] = [];
  private _whereParams: any[] = [];
  private _orderByColumn?: string;
  private _orderByDesc = false;
  private _limitValue = -1;
  private _offsetValue = -1;

  constructor(table: string) {
    this._table = table;
  }

  select(...columns: string[]): this {
    for (const col of columns) {
      if (col !== '*' && !this._selectedColumns.includes(col)) {
        this._selectedColumns.push(col);
      }
    }
    return this;
  }

  where(column: string, valueOrOp: any, value?: any): this {
    if (value === undefined) {
      this._whereConditions.push(quoteDbIdentifier(column) + ' = ?');
      this._whereParams.push(valueOrOp);
    } else {
      const op = String(valueOrOp).toUpperCase();
      if (!ALLOWED_DB_OPERATORS.has(op)) throw new Error('DB operator not allowed: ' + op);
      this._whereConditions.push(quoteDbIdentifier(column) + ' ' + op + ' ?');
      this._whereParams.push(value);
    }
    return this;
  }

  whereIn(column: string, values: any[]): this {
    if (values.length === 0) {
      this._whereConditions.push('1 = 0');
      return this;
    }
    const placeholders = values.map(() => '?').join(', ');
    this._whereConditions.push(quoteDbIdentifier(column) + ' IN (' + placeholders + ')');
    this._whereParams.push(...values);
    return this;
  }

  orderBy(column: string): this {
    this._orderByColumn = column;
    this._orderByDesc = false;
    return this;
  }

  orderByDesc(column: string): this {
    this._orderByColumn = column;
    this._orderByDesc = true;
    return this;
  }

  limit(n: number): this {
    this._limitValue = n;
    return this;
  }

  offset(n: number): this {
    this._offsetValue = n;
    return this;
  }

  private _buildSelectSql(overrideLimit = -1): string {
    let sql = 'SELECT ';
    sql += this._selectedColumns.length === 0
      ? '*'
      : this._selectedColumns.map(quoteDbIdentifier).join(', ');
    sql += ' FROM ' + quoteDbIdentifier(this._table);
    if (this._whereConditions.length > 0) {
      sql += ' WHERE ' + this._whereConditions.join(' AND ');
    }
    if (this._orderByColumn) {
      sql += ' ORDER BY ' + quoteDbIdentifier(this._orderByColumn);
      if (this._orderByDesc) sql += ' DESC';
    }
    const effectiveLimit = overrideLimit > 0 ? overrideLimit : this._limitValue;
    if (effectiveLimit > 0) sql += ' LIMIT ' + effectiveLimit;
    if (this._offsetValue >= 0) sql += ' OFFSET ' + this._offsetValue;
    return sql;
  }

  private _extractRows(result: any): DbRow[] {
    const cols: string[] = result.columns ?? [];
    const rows: any[][] = result.rows ?? [];
    return rows.map(row => {
      const obj: DbRow = {};
      cols.forEach((col, i) => { obj[col] = row[i] ?? null; });
      return obj;
    });
  }

  async get(): Promise<DbRow[]> {
    const result = await NativeAppambitDatabase.execute(
      this._buildSelectSql(),
      this._whereParams,
    );
    if ((result as any).error) throw new Error((result as any).error);
    return this._extractRows(result);
  }

  async first(): Promise<DbRow | null> {
    const result = await NativeAppambitDatabase.execute(
      this._buildSelectSql(1),
      this._whereParams,
    );
    if ((result as any).error) throw new Error((result as any).error);
    const rows = this._extractRows(result);
    return rows.length > 0 ? rows[0]! : null;
  }

  async count(): Promise<number> {
    let sql = 'SELECT COUNT(*) FROM ' + quoteDbIdentifier(this._table);
    if (this._whereConditions.length > 0) {
      sql += ' WHERE ' + this._whereConditions.join(' AND ');
    }
    const result = await NativeAppambitDatabase.execute(sql, this._whereParams);
    if ((result as any).error) throw new Error((result as any).error);
    const rows: any[][] = (result as any).rows ?? [];
    const val = rows[0]?.[0];
    return typeof val === 'number' ? val : parseInt(String(val), 10) || 0;
  }

  async insert(data: Record<string, any>): Promise<DbResult> {
    const cols = Object.keys(data);
    const vals = cols.map(c => data[c]);
    const colList = cols.map(quoteDbIdentifier).join(', ');
    const placeholders = cols.map(() => '?').join(', ');
    const sql = `INSERT INTO ${quoteDbIdentifier(this._table)} (${colList}) VALUES (${placeholders})`;
    const result = await NativeAppambitDatabase.execute(sql, vals);
    if ((result as any).error) throw new Error((result as any).error);
    return result as DbResult;
  }

  async update(data: Record<string, any>): Promise<DbResult> {
    if (this._whereConditions.length === 0) {
      throw new Error(
        'update() without WHERE would affect all rows. Use AppAmbitDatabase.execute() for intentional full-table updates.',
      );
    }
    const cols = Object.keys(data);
    const setClause = cols.map(c => `${quoteDbIdentifier(c)} = ?`).join(', ');
    const params = [...cols.map(c => data[c]), ...this._whereParams];
    const sql = `UPDATE ${quoteDbIdentifier(this._table)} SET ${setClause} WHERE ${this._whereConditions.join(' AND ')}`;
    const result = await NativeAppambitDatabase.execute(sql, params);
    if ((result as any).error) throw new Error((result as any).error);
    return result as DbResult;
  }

  async delete(): Promise<DbResult> {
    if (this._whereConditions.length === 0) {
      throw new Error(
        'delete() without WHERE would delete all rows. Use AppAmbitDatabase.execute() for intentional full-table deletes.',
      );
    }
    const sql = `DELETE FROM ${quoteDbIdentifier(this._table)} WHERE ${this._whereConditions.join(' AND ')}`;
    const result = await NativeAppambitDatabase.execute(sql, this._whereParams);
    if ((result as any).error) throw new Error((result as any).error);
    return result as DbResult;
  }
}

class Database {
  async execute(sql: string, params?: any[]): Promise<DbResult> {
    return NativeAppambitDatabase.execute(sql, params ?? []) as Promise<DbResult>;
  }

  async batch(statements: DbStatementInput[]): Promise<DbResult[]> {
    return NativeAppambitDatabase.batch(statements, false) as Promise<DbResult[]>;
  }

  async batchInTransaction(statements: DbStatementInput[]): Promise<DbResult[]> {
    return NativeAppambitDatabase.batch(statements, true) as Promise<DbResult[]>;
  }

  from(table: string): DbQueryBuilder {
    return new DbQueryBuilder(table);
  }

  statement(sql: string, params?: any[]): DbStatementInput {
    return params !== undefined ? { sql, params } : { sql };
  }
}

export const AppAmbitDatabase = new Database();

export function db(): Database {
  return AppAmbitDatabase;
}
