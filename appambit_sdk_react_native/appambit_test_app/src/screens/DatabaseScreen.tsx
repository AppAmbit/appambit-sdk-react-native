import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  Pressable,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { db } from "appambit";
import type { DbRow } from "appambit";

export default function DatabaseScreen() {
  const [sql, setSql] = useState("SELECT * FROM tasks LIMIT 10");
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<any[][]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function reset() {
    setColumns([]);
    setRows([]);
    setStatus(null);
    setError(null);
  }

  function ok(msg: string) {
    setLoading(false);
    setStatus(msg);
    setError(null);
  }

  function err(msg: string) {
    setLoading(false);
    setError(msg);
    setStatus(null);
  }

  function showRows(dbRows: DbRow[]) {
    if (dbRows.length === 0) {
      setColumns([]);
      setRows([]);
    } else {
      const cols = Object.keys(dbRows[0]!);
      setColumns(cols);
      setRows(dbRows.map((r) => cols.map((c) => r[c] ?? null)));
    }
  }

  async function demoExecute() {
    reset();
    setLoading(true);
    try {
      const q = sql.trim() || "SELECT * FROM tasks LIMIT 10";
      const result = await db().execute(q);
      if (result.error) { err(result.error); return; }
      setColumns(result.columns);
      setRows(result.rows);
      ok(`execute(sql) — rows_read=${result.rowsRead}  rows_written=${result.rowsWritten}`);
    } catch (e: any) { err(e.message ?? "Unknown error"); }
  }

  async function demoExecuteParams() {
    reset();
    setLoading(true);
    try {
      const result = await db().execute(
        "SELECT * FROM tasks WHERE is_completed = ? LIMIT ?",
        [0, 10]
      );
      if (result.error) { err(result.error); return; }
      setColumns(result.columns);
      setRows(result.rows);
      ok(`execute(sql, 0, 10) — pending tasks, rows_read=${result.rowsRead}`);
    } catch (e: any) { err(e.message ?? "Error"); }
  }

  async function demoCreateTable() {
    reset();
    setLoading(true);
    try {
      const result = await db().execute(
        "CREATE TABLE IF NOT EXISTS tasks (id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT, is_completed INTEGER DEFAULT 0, priority TEXT, due_date TEXT)"
      );
      if (result.error) { err(result.error); return; }
      ok(`CREATE TABLE OK — rows_read=${result.rowsRead}  rows_written=${result.rowsWritten}`);
    } catch (e: any) { err(e.message ?? "Error"); }
  }

  async function demoDropTable() {
    reset();
    setLoading(true);
    try {
      const result = await db().execute("DROP TABLE IF EXISTS tasks");
      if (result.error) { err(result.error); return; }
      ok(`DROP TABLE OK — rows_read=${result.rowsRead}  rows_written=${result.rowsWritten}`);
    } catch (e: any) { err(e.message ?? "Error"); }
  }

  async function demoPresetTables() {
    const q = "SELECT name FROM sqlite_master WHERE type = 'table'";
    setSql(q);
    reset();
    setLoading(true);
    try {
      const result = await db().execute(q);
      if (result.error) { err(result.error); return; }
      setColumns(result.columns);
      setRows(result.rows);
      ok(`execute(sql) — rows_read=${result.rowsRead}  rows_written=${result.rowsWritten}`);
    } catch (e: any) { err(e.message ?? "Error"); }
  }

  async function demoPresetWherePriorityHigh() {
    const q = "SELECT * FROM tasks WHERE priority = 'high'";
    setSql(q);
    reset();
    setLoading(true);
    try {
      const result = await db().execute(q);
      if (result.error) { err(result.error); return; }
      setColumns(result.columns);
      setRows(result.rows);
      ok(`execute(sql) — rows_read=${result.rowsRead}  rows_written=${result.rowsWritten}`);
    } catch (e: any) { err(e.message ?? "Error"); }
  }

  async function demoBatch() {
    reset();
    setLoading(true);
    try {
      const results = await db().batch([
        db().statement("INSERT INTO tasks (title, is_completed, priority, due_date) VALUES (?, ?, ?, ?)", ["Buy coffee", 0, "low", "2026-06-10"]),
        db().statement("INSERT INTO tasks (title, is_completed, priority, due_date) VALUES (?, ?, ?, ?)", ["Review PR", 0, "high", "2026-06-05"]),
        db().statement("SELECT COUNT(*) AS total FROM tasks"),
      ]);
      const written = results.reduce((sum, r) => sum + r.rowsWritten, 0);
      setColumns(["statement", "rows_written"]);
      setRows(results.map((r, i) => [i + 1, r.rowsWritten]));
      ok(`batch() — ${written} row(s) written across ${results.length} statements (no transaction)`);
    } catch (e: any) { err(e.message ?? "Batch error"); }
  }

  async function demoBatchInTransaction() {
    reset();
    setLoading(true);
    try {
      const results = await db().batchInTransaction([
        db().statement("INSERT INTO tasks (title, is_completed, priority, due_date) VALUES (?, ?, ?, ?)", ["Team meeting", 0, "high", "2026-06-06"]),
        db().statement("INSERT INTO tasks (title, is_completed, priority, due_date) VALUES (?, ?, ?, ?)", ["Prepare agenda", 0, "medium", "2026-06-06"]),
      ]);
      const written = results.reduce((sum, r) => sum + r.rowsWritten, 0);
      ok(`batchInTransaction() — ${written} row(s) written, rolled back on any failure`);
    } catch (e: any) { err(e.message ?? "Transaction error"); }
  }

  async function demoFluentSelect() {
    reset();
    setLoading(true);
    try {
      const dbRows = await db()
        .from("tasks")
        .select("id", "title", "priority", "due_date")
        .where("is_completed", "=", 0)
        .orderByDesc("due_date")
        .limit(5)
        .get();
      showRows(dbRows);
      ok(dbRows.length === 0 ? "No pending tasks" : `pending tasks to complete — ${dbRows.length} row(s)`);
    } catch (e: any) { err(e.message ?? "Error"); }
  }

  async function demoWhereEquality() {
    reset();
    setLoading(true);
    try {
      const dbRows = await db().from("tasks").where("is_completed", 0).get();
      showRows(dbRows);
      ok(dbRows.length === 0 ? "No pending tasks" : `where(is_completed, 0) — ${dbRows.length} pending task(s)`);
    } catch (e: any) { err(e.message ?? "Error"); }
  }

  async function demoWhereIn() {
    reset();
    setLoading(true);
    try {
      const dbRows = await db()
        .from("tasks")
        .whereIn("priority", ["high", "medium"])
        .orderBy("due_date")
        .get();
      showRows(dbRows);
      ok(dbRows.length === 0 ? "No high/medium tasks" : `whereIn(priority, [high, medium]) — ${dbRows.length} row(s)`);
    } catch (e: any) { err(e.message ?? "Error"); }
  }

  async function demoOffset() {
    reset();
    setLoading(true);
    try {
      const dbRows = await db().from("tasks").orderBy("due_date").limit(5).offset(0).get();
      showRows(dbRows);
      ok(dbRows.length === 0 ? "No tasks" : `limit(5).offset(0) — page 1, ${dbRows.length} row(s)`);
    } catch (e: any) { err(e.message ?? "Error"); }
  }

  async function demoFirst() {
    reset();
    setLoading(true);
    try {
      const row = await db().from("tasks").where("is_completed", "=", 0).orderBy("due_date").first();
      if (!row) { ok("first() — No pending tasks"); return; }
      const cols = Object.keys(row);
      setColumns(cols);
      setRows([cols.map((c) => row[c] ?? null)]);
      ok("first() — next task due");
    } catch (e: any) { err(e.message ?? "Error"); }
  }

  async function demoCount() {
    reset();
    setLoading(true);
    try {
      const count = await db().from("tasks").where("is_completed", 0).count();
      setColumns(["pending_tasks"]);
      setRows([[count]]);
      ok(`count() — ${count} pending task(s)`);
    } catch (e: any) { err(e.message ?? "Error"); }
  }

  async function demoInsert() {
    reset();
    setLoading(true);
    try {
      const result = await db().from("tasks").insert({ title: "New task", is_completed: 0, priority: "medium", due_date: "2026-06-10" });
      if (result.error) { err(result.error); return; }
      ok(`insert() — task created, rows_written=${result.rowsWritten}`);
    } catch (e: any) { err(e.message ?? "Error"); }
  }

  async function demoInsertHigh() {
    reset();
    setLoading(true);
    try {
      const result = await db().from("tasks").insert({ title: "Fix critical bug", is_completed: 0, priority: "high", due_date: "2026-06-05" });
      if (result.error) { err(result.error); return; }
      ok(`insert() high priority — task created, rows_written=${result.rowsWritten}`);
    } catch (e: any) { err(e.message ?? "Error"); }
  }

  async function demoInsertRawSQL() {
    reset();
    setLoading(true);
    try {
      const result = await db().execute(
        "INSERT INTO tasks (title, is_completed, priority, due_date) VALUES (?, ?, ?, ?)",
        ["Raw SQL insert", 0, "medium", "2026-06-12"]
      );
      if (result.error) { err(result.error); return; }
      ok(`execute() INSERT OK — rows_written=${result.rowsWritten}`);
    } catch (e: any) { err(e.message ?? "Error"); }
  }

  async function demoInsertMany() {
    reset();
    setLoading(true);
    try {
      const results = await db().batchInTransaction([
        db().statement("INSERT INTO tasks (title, is_completed, priority, due_date) VALUES (?, ?, ?, ?)", ["Write unit tests", 0, "high", "2026-06-07"]),
        db().statement("INSERT INTO tasks (title, is_completed, priority, due_date) VALUES (?, ?, ?, ?)", ["Update documentation", 0, "low", "2026-06-15"]),
        db().statement("INSERT INTO tasks (title, is_completed, priority, due_date) VALUES (?, ?, ?, ?)", ["Code review", 0, "medium", "2026-06-08"]),
        db().statement("INSERT INTO tasks (title, is_completed, priority, due_date) VALUES (?, ?, ?, ?)", ["Deploy to staging", 0, "high", "2026-06-09"]),
        db().statement("INSERT INTO tasks (title, is_completed, priority, due_date) VALUES (?, ?, ?, ?)", ["Monitor metrics", 0, "low", "2026-06-20"]),
      ]);
      const written = results.reduce((sum, r) => sum + r.rowsWritten, 0);
      ok(`insert many — ${written} rows inserted via batch`);
    } catch (e: any) { err(e.message ?? "Error"); }
  }

  async function demoUpdate() {
    reset();
    setLoading(true);
    try {
      const result = await db().from("tasks").where("title", "New task").update({ is_completed: 1 });
      if (result.error) { err(result.error); return; }
      ok(`update() — task marked as completed, rows_written=${result.rowsWritten}`);
    } catch (e: any) { err(e.message ?? "Error"); }
  }

  async function demoDelete() {
    reset();
    setLoading(true);
    try {
      const result = await db().from("tasks").where("is_completed", 1).delete();
      if (result.error) { err(result.error); return; }
      ok(`delete() — completed tasks deleted, rows_written=${result.rowsWritten}`);
    } catch (e: any) { err(e.message ?? "Error"); }
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <SectionHeader title="Raw SQL" />
        <TextInput
          style={styles.sqlInput}
          value={sql}
          onChangeText={setSql}
          placeholder="SQL"
          multiline
          numberOfLines={3}
        />
        <View style={styles.row}>
          <DbBtn label="execute(sql)" onPress={demoExecute} half disabled={loading} />
          <DbBtn label="execute(sql, params)" onPress={demoExecuteParams} half disabled={loading} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <Chip label="List tables" onPress={demoPresetTables} disabled={loading} />
          <Chip label="SELECT high priority" onPress={demoPresetWherePriorityHigh} disabled={loading} />
        </ScrollView>

        <SectionHeader title="Schema" />
        <View style={styles.row}>
          <DbBtn label="CREATE TABLE tasks" onPress={demoCreateTable} half disabled={loading} />
          <DbBtn label="DROP TABLE tasks" onPress={demoDropTable} half disabled={loading} />
        </View>

        <SectionHeader title="Batch" />
        <View style={styles.row}>
          <DbBtn label="batch()" onPress={demoBatch} half disabled={loading} />
          <DbBtn label="batchInTransaction()" onPress={demoBatchInTransaction} half disabled={loading} />
        </View>

        <SectionHeader title="Fluent Builder — SELECT" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <Chip label="select+where+orderByDesc+limit" onPress={demoFluentSelect} disabled={loading} />
          <Chip label="where(col, val)" onPress={demoWhereEquality} disabled={loading} />
          <Chip label="whereIn()" onPress={demoWhereIn} disabled={loading} />
          <Chip label="limit+offset" onPress={demoOffset} disabled={loading} />
          <Chip label="first()" onPress={demoFirst} disabled={loading} />
          <Chip label="count()" onPress={demoCount} disabled={loading} />
        </ScrollView>

        <SectionHeader title="Fluent Builder — WRITE" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipRow}>
          <Chip label="insert()" onPress={demoInsert} disabled={loading} />
          <Chip label="insert() high" onPress={demoInsertHigh} disabled={loading} />
          <Chip label="insert() raw SQL" onPress={demoInsertRawSQL} disabled={loading} />
          <Chip label="insert many" onPress={demoInsertMany} disabled={loading} />
          <Chip label="update()" onPress={demoUpdate} disabled={loading} />
          <Chip label="delete()" onPress={demoDelete} disabled={loading} />
        </ScrollView>
      </ScrollView>

      <View style={styles.panel}>
        {loading && <ActivityIndicator style={styles.spinner} />}
        {!!status && (
          <View style={styles.statusOk}>
            <Text style={styles.statusOkText}>{status}</Text>
          </View>
        )}
        {!!error && (
          <View style={styles.statusErr}>
            <Text style={styles.statusErrText}>{error}</Text>
          </View>
        )}
        {columns.length > 0 && <ResultTable columns={columns} rows={rows} />}
      </View>
    </View>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

function DbBtn({
  label,
  onPress,
  half,
  disabled,
}: {
  label: string;
  onPress: () => void;
  half?: boolean;
  disabled: boolean;
}) {
  return (
    <Pressable
      style={[styles.btn, half && styles.btnHalf, disabled && styles.btnDisabled]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={styles.btnText}>{label}</Text>
    </Pressable>
  );
}

function Chip({
  label,
  onPress,
  disabled,
}: {
  label: string;
  onPress: () => void;
  disabled: boolean;
}) {
  return (
    <Pressable
      style={[styles.chip, disabled && styles.chipDisabled]}
      onPress={onPress}
      disabled={disabled}
    >
      <Text style={styles.chipText}>{label}</Text>
    </Pressable>
  );
}

function ResultTable({ columns, rows }: { columns: string[]; rows: any[][] }) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator>
      <View>
        <View style={styles.tableHeader}>
          {columns.map((col) => (
            <Text key={col} style={styles.tableHeaderCell}>
              {col}
            </Text>
          ))}
        </View>
        <View style={styles.tableDivider} />
        <ScrollView style={styles.tableBody} nestedScrollEnabled>
          {rows.map((row, ri) => (
            <View key={ri} style={styles.tableRow}>
              {row.map((cell, ci) => (
                <Text
                  key={ci}
                  style={[styles.tableCell, cell === null && styles.tableCellNull]}
                  numberOfLines={2}
                >
                  {cell === null ? "null" : String(cell)}
                </Text>
              ))}
            </View>
          ))}
        </ScrollView>
      </View>
    </ScrollView>
  );
}

const COL_W = 120;

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 16, paddingBottom: 8 },
  sqlInput: {
    borderWidth: 1,
    borderColor: "#aaa",
    borderRadius: 6,
    padding: 8,
    fontFamily: "monospace",
    fontSize: 13,
    minHeight: 72,
    marginBottom: 8,
    textAlignVertical: "top",
  },
  row: { flexDirection: "row", gap: 8, marginBottom: 8 },
  btn: {
    backgroundColor: "#007AFF",
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  btnHalf: { flex: 1, marginBottom: 0 },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: "#fff", fontSize: 12, fontWeight: "600", textAlign: "center" },
  chipRow: { flexDirection: "row", gap: 8, paddingBottom: 12 },
  chip: {
    backgroundColor: "#E8F0FE",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
  },
  chipDisabled: { opacity: 0.5 },
  chipText: { fontSize: 13, color: "#1A73E8", fontWeight: "500" },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#007AFF",
    marginBottom: 6,
    marginTop: 8,
  },
  panel: { paddingHorizontal: 16, paddingBottom: 12 },
  spinner: { marginBottom: 4 },
  statusOk: {
    backgroundColor: "#E8F5E9",
    borderRadius: 6,
    padding: 8,
    marginBottom: 6,
  },
  statusOkText: { fontSize: 12, color: "#1B5E20", fontFamily: "monospace" },
  statusErr: {
    backgroundColor: "#FFEBEE",
    borderRadius: 6,
    padding: 8,
    marginBottom: 6,
  },
  statusErrText: { fontSize: 12, color: "#C62828", fontFamily: "monospace" },
  tableHeader: { flexDirection: "row", backgroundColor: "#EEEEEE" },
  tableHeaderCell: {
    width: COL_W,
    paddingHorizontal: 8,
    paddingVertical: 6,
    fontSize: 12,
    fontWeight: "700",
  },
  tableDivider: { height: 1, backgroundColor: "#CCC" },
  tableBody: { maxHeight: 240 },
  tableRow: { flexDirection: "row", paddingVertical: 3 },
  tableCell: { width: COL_W, paddingHorizontal: 8, fontSize: 12, fontFamily: "monospace" },
  tableCellNull: { color: "#BDBDBD" },
});
