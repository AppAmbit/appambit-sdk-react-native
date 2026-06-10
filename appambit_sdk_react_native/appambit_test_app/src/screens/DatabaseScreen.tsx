import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  ScrollView,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  StyleSheet,
} from "react-native";
import { db } from "appambit";
import type { DbRow } from "appambit";

type DemoItem = { label: string; action: () => void };

export default function DatabaseScreen() {
  const [sql, setSql] = useState("SELECT * FROM tasks LIMIT 10");
  const [columns, setColumns] = useState<string[]>([]);
  const [rows, setRows] = useState<any[][]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(0);

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
      ok(`sqlite_master tables — ${result.rowsRead} row(s)`);
    } catch (e: any) { err(e.message ?? "Error"); }
  }

  async function demoPresetHighPriority() {
    const q = "SELECT * FROM tasks WHERE priority = 'high'";
    setSql(q);
    reset();
    setLoading(true);
    try {
      const result = await db().execute(q);
      if (result.error) { err(result.error); return; }
      setColumns(result.columns);
      setRows(result.rows);
      ok(`tasks WHERE priority='high' — ${result.rowsRead} row(s)`);
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
      setColumns(["statement", "rows_written", "rows_read"]);
      setRows(results.map((r, i) => [i + 1, r.rowsWritten, r.rowsRead]));
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
      setColumns(["statement", "rows_written"]);
      setRows(results.map((r, i) => [i + 1, r.rowsWritten]));
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
      if (dbRows.length === 0) { ok("No pending tasks"); return; }
      showRows(dbRows);
      ok(`from().select().where().orderByDesc().limit(5) — ${dbRows.length} row(s)`);
    } catch (e: any) { err(e.message ?? "Error"); }
  }

  async function demoWhereEquality() {
    reset();
    setLoading(true);
    try {
      const dbRows = await db().from("tasks").where("is_completed", 0).get();
      if (dbRows.length === 0) { ok("No pending tasks"); return; }
      showRows(dbRows);
      ok(`where(is_completed, 0) — ${dbRows.length} pending task(s)`);
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
      if (dbRows.length === 0) { ok("No high/medium tasks"); return; }
      showRows(dbRows);
      ok(`whereIn(priority, [high, medium]) — ${dbRows.length} row(s)`);
    } catch (e: any) { err(e.message ?? "Error"); }
  }

  async function demoOffset() {
    reset();
    setLoading(true);
    try {
      const dbRows = await db().from("tasks").orderBy("due_date").limit(5).offset(0).get();
      if (dbRows.length === 0) { ok("No tasks"); return; }
      showRows(dbRows);
      ok(`limit(5).offset(0) — page 1, ${dbRows.length} row(s)`);
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
      setColumns(["rows_written"]);
      setRows([[result.rowsWritten]]);
      ok(`insert() — task created, rows_written=${result.rowsWritten}`);
    } catch (e: any) { err(e.message ?? "Error"); }
  }

  async function demoInsertHigh() {
    reset();
    setLoading(true);
    try {
      const result = await db().from("tasks").insert({ title: "Fix critical bug", is_completed: 0, priority: "high", due_date: "2026-06-05" });
      if (result.error) { err(result.error); return; }
      setColumns(["rows_written"]);
      setRows([[result.rowsWritten]]);
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
      setColumns(["rows_written"]);
      setRows([[result.rowsWritten]]);
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
      setColumns(["rows_inserted"]);
      setRows([[written]]);
      ok(`insert many — ${written} rows inserted via batch`);
    } catch (e: any) { err(e.message ?? "Error"); }
  }

  async function demoUpdate() {
    reset();
    setLoading(true);
    try {
      const result = await db().from("tasks").where("title", "New task").update({ is_completed: 1 });
      if (result.error) { err(result.error); return; }
      setColumns(["rows_written"]);
      setRows([[result.rowsWritten]]);
      ok(`update() — task marked as completed, rows_written=${result.rowsWritten}`);
    } catch (e: any) { err(e.message ?? "Error"); }
  }

  async function demoDelete() {
    reset();
    setLoading(true);
    try {
      const result = await db().from("tasks").where("is_completed", 1).delete();
      if (result.error) { err(result.error); return; }
      setColumns(["rows_written"]);
      setRows([[result.rowsWritten]]);
      ok(`delete() — completed tasks deleted, rows_written=${result.rowsWritten}`);
    } catch (e: any) { err(e.message ?? "Error"); }
  }

  const demos: DemoItem[] = [
    { label: "Raw SQL → execute(sql)", action: demoExecute },
    { label: "Raw SQL → execute(sql, params)", action: demoExecuteParams },
    { label: "Schema → CREATE TABLE tasks", action: demoCreateTable },
    { label: "Schema → DROP TABLE tasks", action: demoDropTable },
    { label: "Batch → batch()", action: demoBatch },
    { label: "Batch → batchInTransaction()", action: demoBatchInTransaction },
    { label: "Fluent SELECT → select+where+orderByDesc+limit", action: demoFluentSelect },
    { label: "Fluent SELECT → where(col, val)", action: demoWhereEquality },
    { label: "Fluent SELECT → whereIn()", action: demoWhereIn },
    { label: "Fluent SELECT → limit+offset", action: demoOffset },
    { label: "Fluent SELECT → first()", action: demoFirst },
    { label: "Fluent SELECT → count()", action: demoCount },
    { label: "Fluent WRITE → insert()", action: demoInsert },
    { label: "Fluent WRITE → insert() high priority", action: demoInsertHigh },
    { label: "Fluent WRITE → insert() raw SQL", action: demoInsertRawSQL },
    { label: "Fluent WRITE → insert many (batch)", action: demoInsertMany },
    { label: "Fluent WRITE → update()", action: demoUpdate },
    { label: "Fluent WRITE → delete()", action: demoDelete },
    { label: "Preset → List tables", action: demoPresetTables },
    { label: "Preset → SELECT * WHERE priority='high'", action: demoPresetHighPriority },
  ];

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <TextInput
          style={styles.sqlInput}
          value={sql}
          onChangeText={setSql}
          placeholder="SQL"
          multiline
          numberOfLines={3}
        />

        <View style={styles.row}>
          <TouchableOpacity
            style={styles.dropdownBtn}
            onPress={() => setExpanded(true)}
            disabled={loading}
          >
            <Text style={styles.dropdownBtnText} numberOfLines={1}>
              {demos[selectedIndex]!.label}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.runBtn, loading && styles.btnDisabled]}
            onPress={() => demos[selectedIndex]!.action()}
            disabled={loading}
          >
            <Text style={styles.runBtnText}>▶  Run</Text>
          </TouchableOpacity>
        </View>

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
        {loading && <ActivityIndicator style={styles.spinner} />}

        {columns.length > 0 && <ResultTable columns={columns} rows={rows} />}
      </ScrollView>

      <Modal
        visible={expanded}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setExpanded(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setExpanded(false)}
        >
          <View style={styles.modalContent}>
            <ScrollView>
              {demos.map((demo, i) => (
                <TouchableOpacity
                  key={i}
                  style={styles.modalOption}
                  onPress={() => {
                    setSelectedIndex(i);
                    setExpanded(false);
                  }}
                >
                  <Text style={styles.modalOptionText}>{demo.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

function ResultTable({ columns, rows }: { columns: string[]; rows: any[][] }) {
  return (
    <View style={styles.tableCard}>
      <ScrollView horizontal showsHorizontalScrollIndicator>
        <View>
          <View style={styles.tableHeader}>
            {columns.map((col) => (
              <Text key={col} style={styles.tableHeaderCell} numberOfLines={1}>
                {col}
              </Text>
            ))}
          </View>
          <View style={styles.tableDivider} />
          {rows.length === 0 ? (
            <Text style={styles.noRows}>(no rows)</Text>
          ) : (
            <ScrollView style={styles.tableBody} nestedScrollEnabled>
              {rows.map((row, ri) => (
                <View
                  key={ri}
                  style={[styles.tableRow, ri % 2 === 1 && styles.tableRowAlt]}
                >
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
          )}
        </View>
      </ScrollView>
      {rows.length > 0 && (
        <>
          <View style={styles.tableDivider} />
          <Text style={styles.rowCount}>
            {rows.length} row{rows.length === 1 ? "" : "s"}
          </Text>
        </>
      )}
    </View>
  );
}

const COL_W = 140;

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { padding: 12 },
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
  row: { flexDirection: "row", gap: 8, marginBottom: 8, alignItems: "center" },
  dropdownBtn: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: "#d1d5db",
    borderRadius: 8,
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  dropdownBtnText: { fontSize: 13, color: "#374151" },
  runBtn: {
    height: 40,
    backgroundColor: "#007AFF",
    paddingHorizontal: 16,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  btnDisabled: { opacity: 0.5 },
  runBtnText: { color: "#fff", fontSize: 14, fontWeight: "600" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 24,
  },
  modalContent: {
    backgroundColor: "#fff",
    borderRadius: 12,
    maxHeight: "80%",
    overflow: "hidden",
  },
  modalOption: {
    padding: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e5e7eb",
  },
  modalOptionText: { fontSize: 14, color: "#111" },
  spinner: { marginBottom: 8 },
  statusOk: {
    backgroundColor: "#E8F5E9",
    borderRadius: 6,
    padding: 10,
    marginBottom: 8,
  },
  statusOkText: { fontSize: 12, color: "#1B5E20", fontFamily: "monospace" },
  statusErr: {
    backgroundColor: "#FFEBEE",
    borderRadius: 6,
    padding: 10,
    marginBottom: 8,
  },
  statusErrText: { fontSize: 12, color: "#C62828", fontFamily: "monospace" },
  tableCard: {
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#e5e7eb",
    backgroundColor: "#fff",
    overflow: "hidden",
  },
  tableHeader: { flexDirection: "row", backgroundColor: "#E8F0FE" },
  tableHeaderCell: {
    width: COL_W,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 12,
    fontWeight: "700",
    color: "#1A73E8",
  },
  tableDivider: { height: 1, backgroundColor: "#e5e7eb" },
  tableBody: { maxHeight: 320 },
  tableRow: { flexDirection: "row" },
  tableRowAlt: { backgroundColor: "#F5F7FA" },
  tableCell: {
    width: COL_W,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 12,
    fontFamily: "monospace",
  },
  tableCellNull: { color: "#BDBDBD" },
  noRows: {
    padding: 12,
    fontSize: 13,
    color: "#9CA3AF",
  },
  rowCount: {
    padding: 8,
    fontSize: 11,
    color: "#9CA3AF",
  },
});
