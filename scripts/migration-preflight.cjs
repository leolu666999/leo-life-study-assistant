const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");

// Keep reading the established local data directory after the product rename.
const LEGACY_DATA_APP_NAME = "Leo的生活学习助手";
const EXPECTED_TABLES = [
  "assignments",
  "class_sessions",
  "course_occurrences",
  "courses",
  "expenses",
  "important_files",
  "journal_entries",
  "plan_items",
  "plans",
  "progress_items",
  "secure_documents",
  "settings",
  "subtasks",
  "tags",
  "task_progress_entries",
  "task_tags",
  "tasks",
  "timetable_courses",
  "timetable_sources",
  "todo_list_items",
  "todo_lists",
  "uploaded_files"
];
const ALLOWED_CURRENCIES = new Set([
  "AUD", "USD", "CNY", "EUR", "GBP", "JPY", "KRW", "SGD", "MYR", "CAD", "NZD",
  "HKD", "CHF", "THB", "INR", "AED", "SAR", "TWD", "IDR", "PHP", "VND"
]);
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const MAX_IDS = 500;

function parseArgs(argv) {
  const options = {};
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--db") options.db = argv[++index];
    else if (argument === "--uploads") options.uploads = argv[++index];
    else if (argument === "--output-dir") options.outputDir = argv[++index];
    else if (argument === "--no-hash") options.hashFiles = false;
    else if (argument === "--help" || argument === "-h") options.help = true;
    else throw new Error(`Unknown argument: ${argument}`);
  }
  return options;
}

function printHelp() {
  console.log(`Usage: npm run migration:preflight -- [options]

Options:
  --db /absolute/path.db       Scan a SQLite snapshot instead of the configured database
  --uploads /absolute/path     Override the uploads directory
  --output-dir /absolute/path  Override the report output directory
  --no-hash                    Skip file SHA-256 calculation
  --help                       Show this help

The database is always opened read-only. The tool never imports lib/db.ts or calls getDb().`);
}

function resolveSources(options) {
  const defaultRoot = process.env.LEO_APP_DATA_DIR || path.join(os.homedir(), "Library", "Application Support", LEGACY_DATA_APP_NAME);
  const dataDir = process.env.LEO_DATA_DIR || path.join(defaultRoot, "data");
  return {
    dbPath: path.resolve(options.db || process.env.LEO_DB_PATH || path.join(dataDir, "leo_life_study.db")),
    uploadsDir: path.resolve(options.uploads || process.env.LEO_UPLOADS_DIR || path.join(defaultRoot, "uploads")),
    outputDir: path.resolve(options.outputDir || path.join(process.cwd(), "migration-reports")),
    hashFiles: options.hashFiles !== false,
    usedSnapshotOverride: Boolean(options.db)
  };
}

function quoteIdentifier(value) {
  return `"${String(value).replaceAll('"', '""')}"`;
}

function redactHome(value) {
  const home = os.homedir();
  return value === home || value.startsWith(`${home}${path.sep}`) ? `~${value.slice(home.length)}` : value;
}

function hashText(value) {
  return crypto.createHash("sha256").update(String(value)).digest("hex");
}

function hashFile(filePath) {
  const hash = crypto.createHash("sha256");
  const fd = fs.openSync(filePath, "r");
  const buffer = Buffer.allocUnsafe(1024 * 1024);
  try {
    let bytesRead = 0;
    do {
      bytesRead = fs.readSync(fd, buffer, 0, buffer.length, null);
      if (bytesRead > 0) hash.update(buffer.subarray(0, bytesRead));
    } while (bytesRead > 0);
  } finally {
    fs.closeSync(fd);
  }
  return hash.digest("hex");
}

function limited(values) {
  return {
    ids: values.slice(0, MAX_IDS),
    omitted: Math.max(0, values.length - MAX_IDS)
  };
}

function tableExists(foundTables, table) {
  return foundTables.includes(table);
}

function tableColumns(db, table) {
  return db.prepare(`PRAGMA table_info(${quoteIdentifier(table)})`).all();
}

function getPrimaryKeyColumns(db, table) {
  return tableColumns(db, table).filter((column) => Number(column.pk) > 0).sort((a, b) => Number(a.pk) - Number(b.pk));
}

function primaryKeyExpression(columns, alias = "") {
  const prefix = alias ? `${alias}.` : "";
  if (columns.length === 1) return `${prefix}${quoteIdentifier(columns[0].name)}`;
  return columns.map((column) => `${prefix}${quoteIdentifier(column.name)}`).join(" || '|' || ");
}

function schemaAudit(db) {
  const foundTables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map((row) => String(row.name));
  const tables = foundTables.map((table) => {
    const columns = tableColumns(db, table).map((column) => ({
      name: String(column.name),
      type: String(column.type || ""),
      primaryKeyOrder: Number(column.pk),
      nullable: Number(column.notnull) !== 1,
      defaultValue: column.dflt_value === null ? null : String(column.dflt_value)
    }));
    const foreignKeys = db.prepare(`PRAGMA foreign_key_list(${quoteIdentifier(table)})`).all().map((foreignKey) => ({
      from: String(foreignKey.from),
      targetTable: String(foreignKey.table),
      targetColumn: String(foreignKey.to),
      onUpdate: String(foreignKey.on_update),
      onDelete: String(foreignKey.on_delete)
    }));
    const indexes = db.prepare(`PRAGMA index_list(${quoteIdentifier(table)})`).all().map((index) => ({
      name: String(index.name),
      unique: Number(index.unique) === 1,
      origin: String(index.origin),
      partial: Number(index.partial) === 1,
      columns: db.prepare(`PRAGMA index_info(${quoteIdentifier(index.name)})`).all().map((item) => String(item.name))
    }));
    return { name: table, columns, foreignKeys, indexes };
  });
  return {
    expectedTables: EXPECTED_TABLES,
    foundTables,
    missingTables: EXPECTED_TABLES.filter((table) => !foundTables.includes(table)),
    unexpectedTables: foundTables.filter((table) => !EXPECTED_TABLES.includes(table)),
    tables
  };
}

function rowCountAudit(db, foundTables) {
  const sourceRowCounts = {};
  for (const table of foundTables) {
    sourceRowCounts[table] = Number(db.prepare(`SELECT COUNT(*) AS count FROM ${quoteIdentifier(table)}`).get().count);
  }
  return {
    sourceRowCounts,
    totalRows: Object.values(sourceRowCounts).reduce((sum, count) => sum + count, 0)
  };
}

function primaryKeyAudit(db, foundTables) {
  const byTable = [];
  for (const table of foundTables) {
    const pkColumns = getPrimaryKeyColumns(db, table);
    if (pkColumns.length === 0) {
      byTable.push({ table, primaryKeyColumns: [], nullPrimaryKeys: { count: 0, ids: [], omitted: 0 }, duplicatePrimaryKeys: { count: 0, ids: [], omitted: 0 }, invalidPrimaryKeys: { count: 0, ids: [], omitted: 0 }, note: "No primary key declared" });
      continue;
    }
    const pkExpression = primaryKeyExpression(pkColumns);
    const nullCondition = pkColumns.map((column) => `${quoteIdentifier(column.name)} IS NULL`).join(" OR ");
    const nullRows = db.prepare(`SELECT ${pkExpression} AS key FROM ${quoteIdentifier(table)} WHERE ${nullCondition}`).all().map((row) => String(row.key ?? "<null>"));
    const duplicateRows = db.prepare(`SELECT ${pkExpression} AS key, COUNT(*) AS count FROM ${quoteIdentifier(table)} GROUP BY ${pkColumns.map((column) => quoteIdentifier(column.name)).join(", ")} HAVING COUNT(*) > 1`).all();
    const duplicateIds = duplicateRows.map((row) => String(row.key));
    let invalidIds = [];
    if (pkColumns.length === 1 && String(pkColumns[0].name) === "id") {
      invalidIds = db.prepare(`SELECT ${quoteIdentifier("id")} AS id FROM ${quoteIdentifier(table)} WHERE ${quoteIdentifier("id")} IS NOT NULL`).all()
        .map((row) => String(row.id))
        .filter((id) => !UUID_PATTERN.test(id));
    }
    byTable.push({
      table,
      primaryKeyColumns: pkColumns.map((column) => String(column.name)),
      nullPrimaryKeys: { count: nullRows.length, ...limited(nullRows) },
      duplicatePrimaryKeys: { count: duplicateRows.reduce((sum, row) => sum + Number(row.count), 0), ...limited(duplicateIds) },
      invalidPrimaryKeys: { count: invalidIds.length, ...limited(invalidIds) }
    });
  }
  return {
    byTable,
    totals: {
      nullPrimaryKeys: byTable.reduce((sum, item) => sum + item.nullPrimaryKeys.count, 0),
      duplicatePrimaryKeys: byTable.reduce((sum, item) => sum + item.duplicatePrimaryKeys.count, 0),
      invalidPrimaryKeys: byTable.reduce((sum, item) => sum + item.invalidPrimaryKeys.count, 0)
    }
  };
}

function sourceKeyForTable(db, table, alias = "s") {
  const columns = getPrimaryKeyColumns(db, table);
  return columns.length > 0 ? primaryKeyExpression(columns, alias) : `${alias}.rowid`;
}

function validateRelation(db, foundTables, relation) {
  if (!tableExists(foundTables, relation.sourceTable) || !tableExists(foundTables, relation.targetTable)) {
    return { ...relation, skipped: true, missingTargetCount: 0, invalidReferences: { ids: [], omitted: 0 } };
  }
  const sourceKey = sourceKeyForTable(db, relation.sourceTable);
  const sourceField = `s.${quoteIdentifier(relation.sourceColumn)}`;
  const targetField = `t.${quoteIdentifier(relation.targetColumn || "id")}`;
  const rows = db.prepare(`
    SELECT ${sourceKey} AS sourceId, ${sourceField} AS targetId
    FROM ${quoteIdentifier(relation.sourceTable)} s
    LEFT JOIN ${quoteIdentifier(relation.targetTable)} t ON ${targetField} = ${sourceField}
    WHERE ${sourceField} IS NOT NULL AND CAST(${sourceField} AS TEXT) != '' AND ${targetField} IS NULL
  `).all();
  const ids = rows.map((row) => ({ sourceId: String(row.sourceId), targetId: String(row.targetId) }));
  return { ...relation, skipped: false, missingTargetCount: rows.length, invalidReferences: { ids: ids.slice(0, MAX_IDS), omitted: Math.max(0, ids.length - MAX_IDS) } };
}

function relationshipAudit(db, schema) {
  const formalRelations = [];
  for (const table of schema.tables) {
    for (const foreignKey of table.foreignKeys) {
      formalRelations.push(validateRelation(db, schema.foundTables, {
        name: `${table.name}.${foreignKey.from} -> ${foreignKey.targetTable}.${foreignKey.targetColumn}`,
        sourceTable: table.name,
        sourceColumn: foreignKey.from,
        targetTable: foreignKey.targetTable,
        targetColumn: foreignKey.targetColumn,
        onDelete: foreignKey.onDelete,
        onUpdate: foreignKey.onUpdate
      }));
    }
  }
  const logicalDefinitions = [
    ["task parent plan", "tasks", "parentPlanId", "plans"],
    ["task original image", "tasks", "originalImageId", "uploaded_files"],
    ["legacy progress task", "progress_items", "linkedTaskId", "tasks"],
    ["todo source plan", "todo_lists", "sourcePlanId", "plans"],
    ["journal linked plan", "journal_entries", "linkedPlanId", "plans"],
    ["timetable course source", "timetable_courses", "sourceId", "timetable_sources"],
    ["course occurrence source", "course_occurrences", "sourceId", "timetable_sources"],
    ["assignment linked task", "assignments", "linkedTaskId", "tasks"]
  ];
  const logicalRelations = logicalDefinitions.map(([name, sourceTable, sourceColumn, targetTable]) => validateRelation(db, schema.foundTables, {
    name, sourceTable, sourceColumn, targetTable, targetColumn: "id"
  }));

  const polymorphic = { name: "uploaded_files polymorphic link", checked: false, missingTargetCount: 0, unknownTypeCount: 0, invalidReferences: { ids: [], omitted: 0 } };
  if (tableExists(schema.foundTables, "uploaded_files")) {
    polymorphic.checked = true;
    const targetByType = {
      expense: "expenses",
      important_file: "important_files",
      task: "tasks",
      journal: "journal_entries",
      timetable_course: "timetable_courses"
    };
    const invalid = [];
    const rows = db.prepare("SELECT id, linkedEntityType, linkedEntityId FROM uploaded_files WHERE linkedEntityId IS NOT NULL AND linkedEntityId != ''").all();
    for (const row of rows) {
      const type = String(row.linkedEntityType || "");
      const targetTable = targetByType[type];
      if (!targetTable || !tableExists(schema.foundTables, targetTable)) {
        polymorphic.unknownTypeCount += 1;
        invalid.push({ sourceId: String(row.id), targetId: String(row.linkedEntityId), reason: "unknown_entity_type", entityType: type || "<empty>" });
        continue;
      }
      const target = db.prepare(`SELECT 1 AS found FROM ${quoteIdentifier(targetTable)} WHERE id = ? LIMIT 1`).get(row.linkedEntityId);
      if (!target) invalid.push({ sourceId: String(row.id), targetId: String(row.linkedEntityId), reason: "missing_target", entityType: type });
    }
    polymorphic.missingTargetCount = invalid.length;
    polymorphic.invalidReferences = { ids: invalid.slice(0, MAX_IDS), omitted: Math.max(0, invalid.length - MAX_IDS) };
  }
  const all = [...formalRelations, ...logicalRelations];
  return {
    formalRelations,
    logicalRelations,
    polymorphic,
    totals: {
      formalOrphans: formalRelations.reduce((sum, relation) => sum + relation.missingTargetCount, 0),
      logicalOrphans: logicalRelations.reduce((sum, relation) => sum + relation.missingTargetCount, 0) + polymorphic.missingTargetCount
    }
  };
}

function jsonAudit(db, schema) {
  const definitions = [
    { table: "tasks", field: "tags_json", expected: "array" },
    { table: "important_files", field: "tags_json", expected: "array" },
    { table: "course_occurrences", field: "localModifiedFields", expected: "array" },
    { table: "tasks", field: "reminderRule", expected: "object-or-plain", plainAllowed: true }
  ];
  const fields = [];
  for (const definition of definitions) {
    const table = schema.tables.find((item) => item.name === definition.table);
    if (!table || !table.columns.some((column) => column.name === definition.field)) {
      fields.push({ ...definition, skipped: true, validCount: 0, invalidCount: 0, nullCount: 0, emptyCount: 0, plainTextCount: 0, invalidRowIds: { ids: [], omitted: 0 } });
      continue;
    }
    const idExpression = sourceKeyForTable(db, definition.table, "s");
    const rows = db.prepare(`SELECT ${idExpression} AS id, s.${quoteIdentifier(definition.field)} AS value FROM ${quoteIdentifier(definition.table)} s`).all();
    const invalid = [];
    let validCount = 0;
    let nullCount = 0;
    let emptyCount = 0;
    let plainTextCount = 0;
    for (const row of rows) {
      if (row.value === null || row.value === undefined) {
        nullCount += 1;
        continue;
      }
      const value = String(row.value).trim();
      if (!value) {
        emptyCount += 1;
        invalid.push(String(row.id));
        continue;
      }
      if (definition.plainAllowed && !value.startsWith("{") && !value.startsWith("[")) {
        plainTextCount += 1;
        validCount += 1;
        continue;
      }
      try {
        const parsed = JSON.parse(value);
        const validType = definition.expected === "array" ? Array.isArray(parsed) : definition.expected === "object-or-plain" ? Boolean(parsed && typeof parsed === "object" && !Array.isArray(parsed)) : true;
        if (validType) validCount += 1;
        else invalid.push(String(row.id));
      } catch {
        invalid.push(String(row.id));
      }
    }
    fields.push({ ...definition, skipped: false, validCount, invalidCount: invalid.length, nullCount, emptyCount, plainTextCount, invalidRowIds: limited(invalid) });
  }
  return { fields, totalInvalid: fields.reduce((sum, field) => sum + field.invalidCount, 0) };
}

function parseDateOnly(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : null;
}

function parseDateTime(value) {
  if (typeof value !== "string" || !value.trim()) return null;
  const normalized = value.trim();
  const match = normalized.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?(?:Z|[+-]\d{2}:\d{2})?)?$/);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const calendarDate = new Date(Date.UTC(year, month - 1, day));
  if (calendarDate.getUTCFullYear() !== year || calendarDate.getUTCMonth() !== month - 1 || calendarDate.getUTCDate() !== day) return null;
  if (match[4] !== undefined && (Number(match[4]) > 23 || Number(match[5]) > 59 || Number(match[6] || 0) > 59)) return null;
  const timestamp = Date.parse(normalized);
  return Number.isFinite(timestamp) ? new Date(timestamp) : null;
}

function parseTimeOnly(value) {
  if (typeof value !== "string") return null;
  const match = value.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] || 0);
  if (hour > 23 || minute > 59 || second > 59) return null;
  return hour * 3600 + minute * 60 + second;
}

function dateTimeAudit(db, schema) {
  const definitions = [
    ["tasks", "startDate", "datetime"], ["tasks", "dueDate", "datetime"], ["tasks", "createdAt", "datetime"], ["tasks", "updatedAt", "datetime"], ["tasks", "completedAt", "datetime"], ["tasks", "archivedAt", "datetime"],
    ["subtasks", "createdAt", "datetime"], ["subtasks", "updatedAt", "datetime"], ["tags", "createdAt", "datetime"],
    ["plans", "startDate", "date"], ["plans", "endDate", "date"], ["plans", "createdAt", "datetime"], ["plans", "updatedAt", "datetime"],
    ["todo_lists", "date", "date"], ["todo_lists", "createdAt", "datetime"], ["todo_lists", "updatedAt", "datetime"],
    ["todo_list_items", "scheduledStartAt", "datetime"], ["todo_list_items", "scheduledEndAt", "datetime"], ["todo_list_items", "createdAt", "datetime"], ["todo_list_items", "updatedAt", "datetime"],
    ["progress_items", "createdAt", "datetime"], ["progress_items", "updatedAt", "datetime"], ["task_progress_entries", "createdAt", "datetime"],
    ["class_sessions", "startTime", "time"], ["class_sessions", "endTime", "time"], ["assignments", "dueDate", "datetime"],
    ["timetable_sources", "lastSyncedAt", "datetime"], ["timetable_sources", "createdAt", "datetime"], ["timetable_sources", "updatedAt", "datetime"],
    ["timetable_courses", "createdAt", "datetime"], ["timetable_courses", "updatedAt", "datetime"],
    ["course_occurrences", "startAt", "datetime"], ["course_occurrences", "endAt", "datetime"], ["course_occurrences", "originalStartAt", "datetime"], ["course_occurrences", "sourceUpdatedAt", "datetime"], ["course_occurrences", "localModifiedAt", "datetime"], ["course_occurrences", "occurrenceStart", "datetime"], ["course_occurrences", "createdAt", "datetime"], ["course_occurrences", "updatedAt", "datetime"],
    ["journal_entries", "date", "date"], ["journal_entries", "createdAt", "datetime"], ["journal_entries", "updatedAt", "datetime"],
    ["expenses", "date", "date"], ["expenses", "createdAt", "datetime"], ["expenses", "updatedAt", "datetime"],
    ["important_files", "expiryDate", "date"], ["important_files", "createdAt", "datetime"], ["important_files", "updatedAt", "datetime"],
    ["uploaded_files", "createdAt", "datetime"], ["settings", "updatedAt", "datetime"]
  ];
  const fields = [];
  for (const [tableName, fieldName, mode] of definitions) {
    const table = schema.tables.find((item) => item.name === tableName);
    const column = table?.columns.find((item) => item.name === fieldName);
    if (!table || !column) continue;
    const idExpression = sourceKeyForTable(db, tableName, "s");
    const rows = db.prepare(`SELECT ${idExpression} AS id, s.${quoteIdentifier(fieldName)} AS value FROM ${quoteIdentifier(tableName)} s`).all();
    const invalidIds = [];
    const abnormalYearIds = [];
    let nullCount = 0;
    for (const row of rows) {
      if (row.value === null || row.value === undefined || String(row.value).trim() === "") {
        nullCount += 1;
        if (!column.nullable) invalidIds.push(String(row.id));
        continue;
      }
      const parsed = mode === "date" ? parseDateOnly(String(row.value)) : mode === "time" ? parseTimeOnly(String(row.value)) : parseDateTime(String(row.value));
      if (parsed === null) {
        invalidIds.push(String(row.id));
      } else if (mode !== "time") {
        const year = parsed.getUTCFullYear();
        if (year < 1900 || year > 2200) abnormalYearIds.push(String(row.id));
      }
    }
    fields.push({ table: tableName, field: fieldName, mode, nullable: column.nullable, rowCount: rows.length, nullCount, invalidCount: invalidIds.length, invalidRowIds: limited(invalidIds), abnormalYearCount: abnormalYearIds.length, abnormalYearRowIds: limited(abnormalYearIds) });
  }
  const orderChecks = [
    ["tasks", "startDate", "dueDate", "due_before_start", "datetime"],
    ["plans", "startDate", "endDate", "end_before_start", "date"],
    ["todo_list_items", "scheduledStartAt", "scheduledEndAt", "schedule_end_before_start", "datetime"],
    ["course_occurrences", "startAt", "endAt", "course_end_before_start", "datetime"],
    ["class_sessions", "startTime", "endTime", "session_end_before_start", "time"]
  ].map(([table, startField, endField, name, mode]) => {
    const tableInfo = schema.tables.find((item) => item.name === table);
    if (!tableInfo || !tableInfo.columns.some((item) => item.name === startField) || !tableInfo.columns.some((item) => item.name === endField)) return { name, table, invalidCount: 0, invalidRowIds: { ids: [], omitted: 0 }, skipped: true };
    const idExpression = sourceKeyForTable(db, table, "s");
    const rows = db.prepare(`SELECT ${idExpression} AS id, s.${quoteIdentifier(startField)} AS startValue, s.${quoteIdentifier(endField)} AS endValue FROM ${quoteIdentifier(table)} s WHERE s.${quoteIdentifier(startField)} IS NOT NULL AND s.${quoteIdentifier(endField)} IS NOT NULL`).all();
    const invalid = rows.filter((row) => {
      const parser = mode === "date" ? parseDateOnly : mode === "time" ? parseTimeOnly : parseDateTime;
      const start = parser(String(row.startValue));
      const end = parser(String(row.endValue));
      if (start === null || end === null) return false;
      const startValue = start instanceof Date ? start.getTime() : start;
      const endValue = end instanceof Date ? end.getTime() : end;
      return endValue < startValue;
    }).map((row) => String(row.id));
    return { name, table, startField, endField, invalidCount: invalid.length, invalidRowIds: limited(invalid), skipped: false };
  });
  return {
    fields,
    orderChecks,
    totals: {
      invalidValues: fields.reduce((sum, field) => sum + field.invalidCount, 0),
      abnormalYears: fields.reduce((sum, field) => sum + field.abnormalYearCount, 0),
      invalidOrder: orderChecks.reduce((sum, check) => sum + check.invalidCount, 0)
    },
    timezoneRisk: "SQLite stores mixed date-only/local datetime/ISO text. PostgreSQL migration must preserve the source timezone and explicitly test Australia/Sydney DST instead of interpreting every value in the server timezone."
  };
}

function timetableAudit(db, schema, relationships, dateTimes, jsonValidation) {
  const result = {
    timezoneCounts: {}, unknownTimezones: { count: 0, ids: [], omitted: 0 },
    duplicateSourceInstances: { count: 0, ids: [], omitted: 0 },
    missingCourseCount: 0, endBeforeStartCount: 0, invalidOriginalStartAtCount: 0,
    invalidLocalModifiedFieldsCount: 0, consistencyWarnings: { count: 0, ids: [], omitted: 0 },
    sydneySupported: false
  };
  if (tableExists(schema.foundTables, "timetable_sources")) {
    const invalid = [];
    for (const row of db.prepare("SELECT id, timezone FROM timetable_sources").all()) {
      const timezone = String(row.timezone || "");
      result.timezoneCounts[timezone || "<empty>"] = (result.timezoneCounts[timezone || "<empty>"] || 0) + 1;
      try {
        new Intl.DateTimeFormat("en", { timeZone: timezone }).format(new Date());
      } catch {
        invalid.push(String(row.id));
      }
    }
    result.unknownTimezones = { count: invalid.length, ...limited(invalid) };
    result.sydneySupported = Object.hasOwn(result.timezoneCounts, "Australia/Sydney");
  }
  if (tableExists(schema.foundTables, "course_occurrences")) {
    const duplicates = db.prepare(`
      SELECT GROUP_CONCAT(id) AS ids, COUNT(*) AS count
      FROM course_occurrences
      WHERE sourceId IS NOT NULL AND externalUid IS NOT NULL AND occurrenceStart IS NOT NULL
      GROUP BY sourceId, externalUid, occurrenceStart HAVING COUNT(*) > 1
    `).all();
    const duplicateIds = duplicates.flatMap((row) => String(row.ids || "").split(",").filter(Boolean));
    result.duplicateSourceInstances = { count: duplicates.length, ...limited(duplicateIds) };
    const warnings = db.prepare(`
      SELECT id FROM course_occurrences
      WHERE (isException = 1 AND originalStartAt IS NULL)
         OR (localModifiedAt IS NOT NULL AND (localModifiedFields IS NULL OR localModifiedFields = '[]'))
         OR status NOT IN ('scheduled', 'cancelled')
    `).all().map((row) => String(row.id));
    result.consistencyWarnings = { count: warnings.length, ...limited(warnings) };
  }
  result.missingCourseCount = relationships.formalRelations.filter((relation) => relation.sourceTable === "course_occurrences" && relation.sourceColumn === "courseId").reduce((sum, relation) => sum + relation.missingTargetCount, 0);
  result.endBeforeStartCount = dateTimes.orderChecks.find((check) => check.name === "course_end_before_start")?.invalidCount || 0;
  result.invalidOriginalStartAtCount = dateTimes.fields.find((field) => field.table === "course_occurrences" && field.field === "originalStartAt")?.invalidCount || 0;
  result.invalidLocalModifiedFieldsCount = jsonValidation.fields.find((field) => field.table === "course_occurrences" && field.field === "localModifiedFields")?.invalidCount || 0;
  return result;
}

function financeAudit(db, schema, relationships, dateTimes) {
  const result = {
    recordCount: 0, currencyRecordCounts: {}, invalidAmount: { count: 0, ids: [], omitted: 0 },
    negativeAmount: { count: 0, ids: [], omitted: 0 }, unsupportedCurrency: { count: 0, ids: [], omitted: 0 },
    invalidType: { count: 0, ids: [], omitted: 0 }, invalidDateCount: 0, missingReceiptReferences: 0,
    numericMigrationRisk: "SQLite REAL is binary floating point. Convert each finite value to PostgreSQL numeric using a documented decimal string policy; do not aggregate different currencies."
  };
  if (!tableExists(schema.foundTables, "expenses")) return result;
  const rows = db.prepare("SELECT id, amount, currency, type FROM expenses").all();
  result.recordCount = rows.length;
  const invalidAmount = [];
  const negative = [];
  const unsupported = [];
  const invalidType = [];
  for (const row of rows) {
    const id = String(row.id);
    const amount = Number(row.amount);
    const currency = String(row.currency || "");
    result.currencyRecordCounts[currency || "<empty>"] = (result.currencyRecordCounts[currency || "<empty>"] || 0) + 1;
    if (!Number.isFinite(amount)) invalidAmount.push(id);
    else if (amount < 0) negative.push(id);
    if (!ALLOWED_CURRENCIES.has(currency)) unsupported.push(id);
    if (row.type !== "income" && row.type !== "expense") invalidType.push(id);
  }
  result.invalidAmount = { count: invalidAmount.length, ...limited(invalidAmount) };
  result.negativeAmount = { count: negative.length, ...limited(negative) };
  result.unsupportedCurrency = { count: unsupported.length, ...limited(unsupported) };
  result.invalidType = { count: invalidType.length, ...limited(invalidType) };
  result.invalidDateCount = dateTimes.fields.find((field) => field.table === "expenses" && field.field === "date")?.invalidCount || 0;
  result.missingReceiptReferences = relationships.formalRelations.filter((relation) => relation.sourceTable === "expenses" && relation.sourceColumn === "receiptFileId").reduce((sum, relation) => sum + relation.missingTargetCount, 0);
  return result;
}

function walkFiles(root) {
  if (!fs.existsSync(root)) return [];
  const output = [];
  const visit = (directory) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (entry.name.startsWith(".")) continue;
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(absolutePath);
      else if (entry.isFile()) output.push(absolutePath);
    }
  };
  visit(root);
  return output;
}

function fileAudit(db, schema, uploadsDir, hashFiles) {
  const report = {
    uploadsDirectory: redactHome(uploadsDir), directoryExists: fs.existsSync(uploadsDir), hashAlgorithm: hashFiles ? "sha256" : "skipped",
    metadataCount: 0, diskFileCount: 0, metadataBytes: 0, diskBytes: 0,
    missingDiskFiles: { count: 0, ids: [], omitted: 0 }, orphanDiskFiles: { count: 0, files: [], omitted: 0 },
    sizeMismatches: { count: 0, ids: [], omitted: 0 }, pathTraversalRisks: { count: 0, ids: [], omitted: 0 },
    duplicateStoredNames: { count: 0, groups: [], omitted: 0 }, duplicateHashes: { count: 0, groups: [], omitted: 0 },
    orphanMetadata: { count: 0, ids: [], omitted: 0 }, manifest: []
  };
  const diskFiles = walkFiles(uploadsDir);
  report.diskFileCount = diskFiles.length;
  report.diskBytes = diskFiles.reduce((sum, filePath) => sum + fs.statSync(filePath).size, 0);
  if (!tableExists(schema.foundTables, "uploaded_files")) return report;
  const metadata = db.prepare("SELECT id, storedName, path, size, linkedEntityType, linkedEntityId FROM uploaded_files").all();
  report.metadataCount = metadata.length;
  report.metadataBytes = metadata.reduce((sum, row) => sum + Number(row.size || 0), 0);
  const expenses = tableExists(schema.foundTables, "expenses") ? db.prepare("SELECT receiptFileId AS fileId, COUNT(*) AS count FROM expenses WHERE receiptFileId IS NOT NULL GROUP BY receiptFileId").all() : [];
  const important = tableExists(schema.foundTables, "important_files") ? db.prepare("SELECT fileId, COUNT(*) AS count FROM important_files GROUP BY fileId").all() : [];
  const referenceCounts = new Map();
  for (const row of [...expenses, ...important]) referenceCounts.set(String(row.fileId), (referenceCounts.get(String(row.fileId)) || 0) + Number(row.count));
  const byStoredName = new Map();
  const byHash = new Map();
  const matchedDisk = new Set();
  const missing = [];
  const sizeMismatches = [];
  const pathRisks = [];
  const orphanMetadata = [];
  for (const row of metadata) {
    const id = String(row.id);
    const storedName = String(row.storedName || "");
    const candidate = path.resolve(uploadsDir, storedName);
    const insideRoot = candidate.startsWith(`${path.resolve(uploadsDir)}${path.sep}`) && !path.isAbsolute(storedName) && !storedName.split(/[\\/]/).includes("..");
    const metadataPath = String(row.path || "");
    const metadataPathRisk = metadataPath.split(/[\\/]/).includes("..") || (path.isAbsolute(metadataPath) && !path.resolve(metadataPath).startsWith(`${path.resolve(uploadsDir)}${path.sep}`));
    if (!insideRoot || metadataPathRisk) pathRisks.push(id);
    const list = byStoredName.get(storedName) || [];
    list.push(id);
    byStoredName.set(storedName, list);
    const exists = insideRoot && fs.existsSync(candidate) && fs.statSync(candidate).isFile();
    if (exists) {
      const realRoot = fs.realpathSync(uploadsDir);
      const realCandidate = fs.realpathSync(candidate);
      if (!realCandidate.startsWith(`${realRoot}${path.sep}`)) pathRisks.push(id);
    }
    let actualSize = null;
    let sha256 = null;
    if (!exists) {
      missing.push(id);
    } else {
      matchedDisk.add(candidate);
      actualSize = fs.statSync(candidate).size;
      if (actualSize !== Number(row.size)) sizeMismatches.push(id);
      if (hashFiles) {
        sha256 = hashFile(candidate);
        const ids = byHash.get(sha256) || [];
        ids.push(id);
        byHash.set(sha256, ids);
      }
    }
    const referenceCount = referenceCounts.get(id) || 0;
    if (referenceCount === 0) orphanMetadata.push(id);
    const category = referenceCount > 0
      ? (expenses.some((item) => String(item.fileId) === id) ? "receipt" : "important_file")
      : (row.linkedEntityType ? String(row.linkedEntityType) : "unlinked");
    report.manifest.push({ fileId: id, metadataSize: Number(row.size), actualSize, sha256, category, referenceCount, status: !exists ? "missing" : actualSize !== Number(row.size) ? "size_mismatch" : referenceCount === 0 ? "orphan_metadata" : "ok" });
  }
  const orphanDisk = diskFiles.filter((filePath) => !matchedDisk.has(path.resolve(filePath))).map((filePath) => {
    const stat = fs.statSync(filePath);
    return {
      anonymousId: `disk-${hashText(path.relative(uploadsDir, filePath)).slice(0, 16)}`,
      size: stat.size,
      sha256: hashFiles ? hashFile(filePath) : null
    };
  });
  const duplicateStoredNames = [...byStoredName.entries()].filter(([, ids]) => ids.length > 1).map(([, ids]) => ({ fileIds: ids }));
  const duplicateHashes = [...byHash.entries()].filter(([, ids]) => ids.length > 1).map(([sha256, ids]) => ({ sha256, fileIds: ids }));
  report.missingDiskFiles = { count: missing.length, ...limited(missing) };
  report.orphanDiskFiles = { count: orphanDisk.length, files: orphanDisk.slice(0, MAX_IDS), omitted: Math.max(0, orphanDisk.length - MAX_IDS) };
  report.sizeMismatches = { count: sizeMismatches.length, ...limited(sizeMismatches) };
  const uniquePathRisks = [...new Set(pathRisks)];
  report.pathTraversalRisks = { count: uniquePathRisks.length, ...limited(uniquePathRisks) };
  report.duplicateStoredNames = { count: duplicateStoredNames.length, groups: duplicateStoredNames.slice(0, MAX_IDS), omitted: Math.max(0, duplicateStoredNames.length - MAX_IDS) };
  report.duplicateHashes = { count: duplicateHashes.length, groups: duplicateHashes.slice(0, MAX_IDS), omitted: Math.max(0, duplicateHashes.length - MAX_IDS) };
  report.orphanMetadata = { count: orphanMetadata.length, ...limited(orphanMetadata) };
  return report;
}

function staticCodeAudit(projectRoot, foundTables) {
  const read = (relativePath) => fs.readFileSync(path.join(projectRoot, relativePath), "utf8");
  const component = read("components/leo-app.tsx");
  const syncRoute = read("app/api/sync/push/route.ts");
  const backupDb = read("lib/db.ts");
  const routes = [
    ["/api/backup/export", "app/api/backup/export/route.ts"],
    ["/api/health", "app/api/health/route.ts"],
    ["/api/uploads/[id]", "app/api/uploads/[id]/route.ts"],
    ["/api/timetable/import/preview", "app/api/timetable/import/preview/route.ts"],
    ["/api/sync/push", "app/api/sync/push/route.ts"],
    ["/api/network", "app/api/network/route.ts"]
  ];
  const publicApiExposure = routes.map(([route, relativePath]) => {
    const source = read(relativePath);
    const authenticated = /auth\.getUser\s*\(|requireUser\s*\(|getSession\s*\(/.test(source);
    return {
      route,
      authenticated,
      leaksAbsolutePaths: route === "/api/health" && /databasePath|dataDir|uploadsDir|logDir/.test(source),
      privateDataAccess: route === "/api/backup/export" || route === "/api/uploads/[id]" || route === "/api/sync/push",
      ssrfRisk: route === "/api/timetable/import/preview" && /fetch\(feedUrl/.test(source) && !/isPrivateIp|allowedHost|new URL\(feedUrl\)/.test(source),
      localOsDependency: route === "/api/network" && /node:os|networkInterfaces/.test(source),
      mustCloseOrRefactorBeforeCloud: true
    };
  });

  const entityTypeMatch = syncRoute.match(/type SyncEntityType\s*=\s*([^;]+);/s);
  const supportedEntityTypes = entityTypeMatch ? [...entityTypeMatch[1].matchAll(/"([^"]+)"/g)].map((match) => match[1]) : [];
  const offlineMethods = [...component.matchAll(/if \(method !== "([A-Z]+)"\)/g)].map((match) => match[1]);
  const offlineSyncRiskSummary = {
    supportedEntityTypes,
    queueKey: "localId",
    includesDeviceId: /deviceId/.test(component) && /deviceId/.test(syncRoute),
    persistentServerIdempotencyLedger: /sync_operations|idempotency|INSERT[^\n]+localId/i.test(syncRoute),
    offlineMutationMethods: offlineMethods.length > 0 ? [offlineMethods[0]] : ["POST"],
    patchSupportedOffline: false,
    deleteSupportedOffline: false,
    duplicateCreateRisk: true,
    directCloudSyncProtocolReady: false,
    conclusion: "The IndexedDB queue only stores selected create operations. The server does not persist (user, deviceId, localId) idempotency, and PATCH/DELETE are not queued; it cannot be used directly as a cloud synchronization protocol."
  };

  const exportFunction = backupDb.slice(backupDb.indexOf("export function exportBackup()"));
  const semanticallyIncludedTables = [
    "tasks", "subtasks", "task_progress_entries", "plans", "plan_items", "courses", "class_sessions",
    "assignments", "journal_entries", "expenses", "important_files", "secure_documents", "uploaded_files", "settings"
  ].filter((table) => foundTables.includes(table));
  const backupCompleteness = {
    routeFound: /exportBackup\(\)/.test(read("app/api/backup/export/route.ts")),
    includedTables: semanticallyIncludedTables,
    missingTables: foundTables.filter((table) => !semanticallyIncludedTables.includes(table)),
    fileBinariesIncluded: false,
    importRestorePathFound: false,
    exposesLocalPaths: /databasePath:\s*dbPath|uploadsPath:\s*uploadsDir/.test(exportFunction),
    restorable: false,
    conclusion: "The current export is an unauthenticated partial JSON export. It omits multiple source tables, contains no file binaries, and has no implemented import/restore path."
  };
  return { offlineSyncRiskSummary, backupCompleteness, publicApiExposure };
}

function scoreReport(report) {
  const clamp = (value) => Math.max(0, Math.min(100, Math.round(value)));
  const pkIssues = report.primaryKeyValidation.totals.nullPrimaryKeys + report.primaryKeyValidation.totals.duplicatePrimaryKeys + report.primaryKeyValidation.totals.invalidPrimaryKeys;
  const relationIssues = report.relationshipValidation.totals.formalOrphans + report.relationshipValidation.totals.logicalOrphans;
  const fileIssues = report.fileManifestSummary.missingDiskFiles.count + report.fileManifestSummary.orphanDiskFiles.count + report.fileManifestSummary.sizeMismatches.count + report.fileManifestSummary.pathTraversalRisks.count;
  const timetableIssues = report.timetableValidation.unknownTimezones.count + report.timetableValidation.duplicateSourceInstances.count + report.timetableValidation.missingCourseCount + report.timetableValidation.endBeforeStartCount + report.timetableValidation.invalidOriginalStartAtCount + report.timetableValidation.invalidLocalModifiedFieldsCount;
  const financeIssues = report.financeValidation.invalidAmount.count + report.financeValidation.negativeAmount.count + report.financeValidation.unsupportedCurrency.count + report.financeValidation.invalidType.count + report.financeValidation.invalidDateCount + report.financeValidation.missingReceiptReferences;
  const categories = {
    databaseIntegrity: clamp(100 - report.schema.missingTables.length * 20 - pkIssues * 5),
    relationshipIntegrity: clamp(100 - relationIssues * 8),
    jsonValidity: clamp(100 - report.jsonValidation.totalInvalid * 10),
    timeDateReadiness: clamp(100 - report.dateTimeValidation.totals.invalidValues * 5 - report.dateTimeValidation.totals.abnormalYears * 5 - report.dateTimeValidation.totals.invalidOrder * 8),
    timetableReadiness: clamp(100 - timetableIssues * 8),
    financeReadiness: clamp(100 - financeIssues * 10),
    fileReadiness: clamp(100 - fileIssues * 10 - report.fileManifestSummary.orphanMetadata.count * 3),
    backupReadiness: report.backupCompleteness.restorable ? 100 : 10,
    authReadiness: report.publicApiExposure.every((api) => api.authenticated) ? 100 : 0,
    offlineSyncReadiness: report.offlineSyncRiskSummary.directCloudSyncProtocolReady ? 100 : 15,
    vercelReadiness: 10
  };
  const score = clamp(Object.values(categories).reduce((sum, value) => sum + value, 0) / Object.keys(categories).length);
  const blockers = [
    { code: "AUTH_MISSING", severity: "BLOCKER", message: "Private API routes have no authenticated user boundary or RLS-backed ownership." },
    { code: "LOCAL_PERSISTENCE", severity: "BLOCKER", message: "Runtime persistence still depends on local SQLite and local uploads, which cannot be the Vercel source of truth." },
    { code: "BACKUP_NOT_RESTORABLE", severity: "BLOCKER", message: "The current backup export is partial and has no file binaries or restore path." },
    { code: "OFFLINE_SYNC_NOT_IDEMPOTENT", severity: "HIGH", message: "Offline create replay can duplicate records and does not cover PATCH or DELETE." },
    { code: "MIXED_TEMPORAL_FORMATS", severity: "MEDIUM", message: "Date-only, local datetime and ISO timestamp text require an explicit timezone conversion policy." },
    { code: "DUAL_TAG_REPRESENTATION", severity: "MEDIUM", message: "Task tags exist in both tags_json and normalized tag tables; migration must define one canonical source." },
    { code: "LEGACY_COMPATIBILITY_MODELS", severity: "LOW", message: "Legacy progress and course tables should remain isolated until reconciliation is complete." }
  ];
  if (report.schema.missingTables.length > 0 || pkIssues > 0) blockers.push({ code: "DATABASE_INTEGRITY", severity: "BLOCKER", message: "Schema or primary-key integrity issues must be resolved before migration." });
  if (report.relationshipValidation.totals.formalOrphans > 0) blockers.push({ code: "FORMAL_ORPHANS", severity: "BLOCKER", message: "Formal foreign-key orphan records were found." });
  if (report.relationshipValidation.totals.logicalOrphans > 0) blockers.push({ code: "LOGICAL_ORPHANS", severity: "HIGH", message: "Logical references need an explicit migration decision." });
  if (report.jsonValidation.totalInvalid > 0 || report.dateTimeValidation.totals.invalidValues > 0) blockers.push({ code: "CONVERSION_ERRORS", severity: "HIGH", message: "Invalid JSON/date values require a documented conversion policy." });
  if (report.fileManifestSummary.missingDiskFiles.count > 0 || report.fileManifestSummary.pathTraversalRisks.count > 0) blockers.push({ code: "FILE_INTEGRITY", severity: "BLOCKER", message: "Missing or unsafe file records must be reconciled before Storage migration." });
  return {
    score,
    categories,
    findings: blockers,
    phase1RepositoryReady: report.schema.missingTables.length === 0 && pkIssues === 0,
    interpretation: score >= 80 ? "Ready for controlled repository work, not production cutover." : score >= 60 ? "Repository preparation can start with blockers tracked; cloud cutover is not ready." : "Not ready for cloud migration. Only preparatory repository work should proceed."
  };
}

function markdownTable(headers, rows) {
  const safe = (value) => String(value ?? "").replaceAll("|", "\\|").replaceAll("\n", " ");
  return [`| ${headers.map(safe).join(" | ")} |`, `| ${headers.map(() => "---").join(" | ")} |`, ...rows.map((row) => `| ${row.map(safe).join(" | ")} |`)].join("\n");
}

function issueIdSummary(value) {
  const ids = value?.ids || [];
  if (ids.length === 0) return "-";
  return `${ids.map((id) => typeof id === "string" ? id : id.sourceId || id.fileId || JSON.stringify(id)).join(", ")}${value.omitted ? ` (+${value.omitted} omitted)` : ""}`;
}

function renderMarkdown(report) {
  const readinessRows = Object.entries(report.migrationReadiness.categories).map(([category, score]) => [category, `${score}/100`]);
  const relationRows = [...report.relationshipValidation.formalRelations, ...report.relationshipValidation.logicalRelations].map((item) => [item.name, item.sourceTable, item.targetTable, item.missingTargetCount, issueIdSummary(item.invalidReferences)]);
  const jsonRows = report.jsonValidation.fields.map((item) => [`${item.table}.${item.field}`, item.expected, item.validCount, item.invalidCount, item.nullCount, item.emptyCount, issueIdSummary(item.invalidRowIds)]);
  const dateRows = report.dateTimeValidation.fields.filter((item) => item.invalidCount > 0 || item.abnormalYearCount > 0).map((item) => [`${item.table}.${item.field}`, item.mode, item.nullCount, item.invalidCount, item.abnormalYearCount, issueIdSummary(item.invalidRowIds)]);
  const apiRows = report.publicApiExposure.map((item) => [item.route, item.authenticated ? "yes" : "no", item.leaksAbsolutePaths ? "yes" : "no", item.privateDataAccess ? "yes" : "no", item.ssrfRisk ? "yes" : "no", item.localOsDependency ? "yes" : "no", "yes"]);
  const blockerRows = report.migrationReadiness.findings.map((item) => [item.severity, item.code, item.message]);
  const currencyRows = Object.entries(report.financeValidation.currencyRecordCounts).map(([currency, count]) => [currency, count]);
  return `# SQLite Migration Preflight Report

Generated: ${report.generatedAt}  
Privacy mode: IDs, counts and hashes only. No titles, journal text, notes, filenames, Feed URLs or tokens are included.

## 1. Executive Summary

- Migration readiness score: **${report.migrationReadiness.score}/100**
- Found tables: **${report.schema.foundTables.length}**; expected: **${report.schema.expectedTables.length}**
- Total database rows: **${report.rowCounts.totalRows}**
- Uploaded-file metadata: **${report.fileManifestSummary.metadataCount}**; disk files: **${report.fileManifestSummary.diskFileCount}**
- Formal relationship orphans: **${report.relationshipValidation.totals.formalOrphans}**
- Logical relationship issues: **${report.relationshipValidation.totals.logicalOrphans}**
- Invalid JSON values: **${report.jsonValidation.totalInvalid}**
- Invalid date/time values: **${report.dateTimeValidation.totals.invalidValues}**
- Missing disk files: **${report.fileManifestSummary.missingDiskFiles.count}**
- Phase 1 Repository work: **${report.migrationReadiness.phase1RepositoryReady ? "may start with listed cloud blockers tracked" : "do not start until database baseline blockers are resolved"}**

## 2. Database Source

- Database: \`${report.databaseSource.database}\`
- Uploads: \`${report.databaseSource.uploads}\`
- Read-only SQLite connection: **yes**
- Snapshot override used: **${report.databaseSource.snapshotOverrideUsed ? "yes" : "no"}**
- Recommendation: formal migration runs should use \`--db\` with a consistent SQLite snapshot.

## 3. Schema Summary

- Expected tables: ${report.schema.expectedTables.join(", ")}
- Found tables: ${report.schema.foundTables.join(", ")}
- Missing tables: ${report.schema.missingTables.join(", ") || "none"}
- Unexpected tables: ${report.schema.unexpectedTables.join(", ") || "none"}
- Full column, PK, FK, default, nullable, unique and index metadata is available in the companion JSON report.

## 4. Row Counts

${markdownTable(["Table", "Rows"], Object.entries(report.rowCounts.sourceRowCounts).map(([table, count]) => [table, count]))}

## 5. Primary Key Validation

- Null primary keys: **${report.primaryKeyValidation.totals.nullPrimaryKeys}**
- Duplicate primary keys: **${report.primaryKeyValidation.totals.duplicatePrimaryKeys}**
- Invalid UUID primary keys: **${report.primaryKeyValidation.totals.invalidPrimaryKeys}**

${markdownTable(["Table", "PK", "Null", "Duplicate", "Invalid UUID"], report.primaryKeyValidation.byTable.map((item) => [item.table, item.primaryKeyColumns.join(",") || "none", item.nullPrimaryKeys.count, item.duplicatePrimaryKeys.count, item.invalidPrimaryKeys.count]))}

## 6. Relationship Validation

${relationRows.length ? markdownTable(["Relation", "Source", "Target", "Missing", "Source IDs"], relationRows) : "No relations found."}

- Polymorphic upload-link issues: **${report.relationshipValidation.polymorphic.missingTargetCount}**

## 7. JSON Validation

${markdownTable(["Field", "Expected", "Valid", "Invalid", "Null", "Empty", "Invalid IDs"], jsonRows)}

## 8. Date/Time Validation

- Invalid values: **${report.dateTimeValidation.totals.invalidValues}**
- Abnormal years: **${report.dateTimeValidation.totals.abnormalYears}**
- End-before-start issues: **${report.dateTimeValidation.totals.invalidOrder}**

${dateRows.length ? markdownTable(["Field", "Mode", "Null", "Invalid", "Abnormal year", "IDs"], dateRows) : "No invalid date/time fields found."}

Timezone risk: ${report.dateTimeValidation.timezoneRisk}

## 9. Timetable & Timezone Validation

- Timezones: ${Object.entries(report.timetableValidation.timezoneCounts).map(([zone, count]) => `${zone}=${count}`).join(", ") || "none"}
- Invalid IANA timezone: **${report.timetableValidation.unknownTimezones.count}**
- Duplicate source instances: **${report.timetableValidation.duplicateSourceInstances.count}**
- Missing course references: **${report.timetableValidation.missingCourseCount}**
- End before start: **${report.timetableValidation.endBeforeStartCount}**
- Consistency warnings: **${report.timetableValidation.consistencyWarnings.count}**
- Australia/Sydney present: **${report.timetableValidation.sydneySupported ? "yes" : "no"}**

## 10. Finance & Currency Validation

${currencyRows.length ? markdownTable(["Currency", "Record count"], currencyRows) : "No expense records."}

- Invalid/non-finite amount: **${report.financeValidation.invalidAmount.count}**
- Negative amount: **${report.financeValidation.negativeAmount.count}**
- Unsupported currency: **${report.financeValidation.unsupportedCurrency.count}**
- Invalid type: **${report.financeValidation.invalidType.count}**
- Invalid date: **${report.financeValidation.invalidDateCount}**
- Missing receipt metadata: **${report.financeValidation.missingReceiptReferences}**
- Cross-currency totals were not calculated.
- PostgreSQL risk: ${report.financeValidation.numericMigrationRisk}

## 11. File Manifest Summary

- Metadata rows: **${report.fileManifestSummary.metadataCount}** (${report.fileManifestSummary.metadataBytes} bytes declared)
- Disk files: **${report.fileManifestSummary.diskFileCount}** (${report.fileManifestSummary.diskBytes} bytes)
- Missing disk files: **${report.fileManifestSummary.missingDiskFiles.count}**
- Size mismatches: **${report.fileManifestSummary.sizeMismatches.count}**
- Path traversal risks: **${report.fileManifestSummary.pathTraversalRisks.count}**
- Duplicate stored names: **${report.fileManifestSummary.duplicateStoredNames.count}**
- Duplicate content hashes: **${report.fileManifestSummary.duplicateHashes.count}**
- Orphan metadata: **${report.fileManifestSummary.orphanMetadata.count}**

The JSON manifest contains file IDs, sizes, SHA-256, category, reference count and status only.

## 12. Orphan Files

- Disk files without metadata: **${report.fileManifestSummary.orphanDiskFiles.count}**
- Anonymous disk IDs: ${report.fileManifestSummary.orphanDiskFiles.files.map((item) => item.anonymousId).join(", ") || "none"}
- Original filenames are intentionally excluded.

## 13. Offline Sync Risk

- Supported entity types: ${report.offlineSyncRiskSummary.supportedEntityTypes.join(", ")}
- localId: yes
- deviceId: ${report.offlineSyncRiskSummary.includesDeviceId ? "yes" : "no"}
- Persistent server idempotency ledger: ${report.offlineSyncRiskSummary.persistentServerIdempotencyLedger ? "yes" : "no"}
- Offline methods: ${report.offlineSyncRiskSummary.offlineMutationMethods.join(", ")}
- PATCH offline: ${report.offlineSyncRiskSummary.patchSupportedOffline ? "yes" : "no"}
- DELETE offline: ${report.offlineSyncRiskSummary.deleteSupportedOffline ? "yes" : "no"}
- Suitable as direct cloud sync protocol: **${report.offlineSyncRiskSummary.directCloudSyncProtocolReady ? "yes" : "no"}**

${report.offlineSyncRiskSummary.conclusion}

## 14. Backup Completeness

- Included/represented tables: ${report.backupCompleteness.includedTables.join(", ")}
- Missing tables: ${report.backupCompleteness.missingTables.join(", ") || "none"}
- File binaries included: ${report.backupCompleteness.fileBinariesIncluded ? "yes" : "no"}
- Restore path implemented: ${report.backupCompleteness.importRestorePathFound ? "yes" : "no"}
- Fully restorable: **${report.backupCompleteness.restorable ? "yes" : "no"}**

${report.backupCompleteness.conclusion}

## 15. Public API Exposure

${markdownTable(["Route", "Auth", "Absolute path leak", "Private data", "SSRF", "Local OS", "Must refactor"], apiRows)}

## 16. Vercel Blockers

${report.vercelBlockers.map((item) => `- ${item}`).join("\n")}

## 17. Migration Readiness Score

${markdownTable(["Category", "Score"], readinessRows)}

Overall: **${report.migrationReadiness.score}/100**. ${report.migrationReadiness.interpretation}

## 18. BLOCKERS

${markdownTable(["Severity", "Code", "Finding"], blockerRows)}

## 19. Recommended Next Step

${report.recommendedNextStep}
`;
}

function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) {
    printHelp();
    return;
  }
  const projectRoot = path.resolve(__dirname, "..");
  const sources = resolveSources(options);
  if (!fs.existsSync(sources.dbPath)) throw new Error(`SQLite database not found: ${redactHome(sources.dbPath)}`);
  const beforeStat = fs.statSync(sources.dbPath);
  const db = new DatabaseSync(sources.dbPath, { readOnly: true });
  db.exec("PRAGMA query_only = ON;");
  let report;
  try {
    const schema = schemaAudit(db);
    const rowCounts = rowCountAudit(db, schema.foundTables);
    const primaryKeyValidation = primaryKeyAudit(db, schema.foundTables);
    const relationshipValidation = relationshipAudit(db, schema);
    const jsonValidation = jsonAudit(db, schema);
    const dateTimeValidation = dateTimeAudit(db, schema);
    const timetableValidation = timetableAudit(db, schema, relationshipValidation, dateTimeValidation, jsonValidation);
    const financeValidation = financeAudit(db, schema, relationshipValidation, dateTimeValidation);
    const fileManifestSummary = fileAudit(db, schema, sources.uploadsDir, sources.hashFiles);
    const staticAudit = staticCodeAudit(projectRoot, schema.foundTables);
    report = {
      reportVersion: 1,
      generatedAt: new Date().toISOString(),
      privacy: { includesPrivateBodyText: false, includesOriginalFilenames: false, includesFeedUrls: false, includesTokens: false, allowedIdentifiers: ["database IDs", "anonymous disk IDs", "SHA-256"] },
      databaseSource: { database: redactHome(sources.dbPath), uploads: redactHome(sources.uploadsDir), readOnly: true, queryOnlyPragma: true, snapshotOverrideUsed: sources.usedSnapshotOverride },
      schema,
      rowCounts,
      primaryKeyValidation,
      relationshipValidation,
      jsonValidation,
      dateTimeValidation,
      timetableValidation,
      financeValidation,
      fileManifestSummary,
      ...staticAudit,
      vercelBlockers: [
        "SQLite and local uploads are not durable Vercel persistence.",
        "Private APIs have no authentication or per-user ownership boundary.",
        "Process-local EventEmitter/SSE is not cross-instance realtime.",
        "Health and network endpoints expose or depend on local-machine details.",
        "Calendar Feed preview permits server-side URL fetch without SSRF controls.",
        "Uploads use server memory and local filesystem without server-side quota/type enforcement.",
        "PWA/offline queue lacks cloud-grade idempotency and conflict handling."
      ],
      recommendedNextStep: "Phase 1 Repository refactoring may begin only as a behavior-preserving change behind the existing API contract, with SQLite remaining the active backend. Track every BLOCKER, add contract tests first, and do not connect Supabase or cut over data yet."
    };
    report.migrationReadiness = scoreReport(report);
  } finally {
    db.close();
  }
  const afterStat = fs.statSync(sources.dbPath);
  report.sourceMutationGuard = {
    databaseSizeBefore: beforeStat.size,
    databaseSizeAfter: afterStat.size,
    databaseMtimeBefore: beforeStat.mtime.toISOString(),
    databaseMtimeAfter: afterStat.mtime.toISOString(),
    unchangedDuringRun: beforeStat.size === afterStat.size && beforeStat.mtimeMs === afterStat.mtimeMs
  };

  fs.mkdirSync(sources.outputDir, { recursive: true });
  const timestamp = report.generatedAt.replaceAll(":", "-").replaceAll(".", "-");
  const baseName = `preflight-${timestamp}`;
  const jsonPath = path.join(sources.outputDir, `${baseName}.json`);
  const markdownPath = path.join(sources.outputDir, `${baseName}.md`);
  fs.writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  fs.writeFileSync(markdownPath, renderMarkdown(report), { encoding: "utf8", mode: 0o600 });

  console.log(`Migration preflight complete (read-only source).`);
  console.log(`Tables: ${report.schema.foundTables.length}; rows: ${report.rowCounts.totalRows}; files: ${report.fileManifestSummary.diskFileCount}`);
  console.log(`Readiness: ${report.migrationReadiness.score}/100`);
  console.log(`JSON report: ${redactHome(jsonPath)}`);
  console.log(`Markdown report: ${redactHome(markdownPath)}`);
  if (!report.sourceMutationGuard.unchangedDuringRun) {
    console.warn("Warning: database size or mtime changed during the scan. The connection was read-only; another running process may have written to the live database. Use --db with a stopped, consistent snapshot for formal migration.");
  }
}

try {
  main();
} catch (error) {
  console.error(`Migration preflight failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}
