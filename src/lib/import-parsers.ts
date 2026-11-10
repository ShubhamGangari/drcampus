// ==============================================================================
// Student Import parsers (pure, unit-tested).
//
// Parses uploaded documents (CSV / JSON / text-based PDF) into normalized student
// rows for bulk create-or-update. Every function here is pure (no DB, no Next.js
// runtime) so the tester can unit-test them with node:test.
//
// Format support:
//   - CSV  : header row + body rows; quoted fields handled.
//   - JSON : array of objects, or an object with a `students`/`rows` array.
//   - PDF  : best-effort text extraction from content streams (FlateDecode via
//     node:zlib, or raw latin1 fallback), then parsed as a delimited table.
// ==============================================================================

import { inflateRawSync } from 'node:zlib';

/** A raw row imported from a document, keyed by normalized column header. */
export type ImportRow = Record<string, string>;

/** Canonical, column-aliased student fields produced by normalizeStudentRow. */
export interface CanonicalStudentRow {
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    dob: string;
    gender: string;
    category: string;
    rollNo: string;
    programCode: string;
    programId: string;
    batchName: string;
    batchId: string;
    schoolId: string;
    status: string;
}

/**
 * Normalize a column header: lowercase, dashes/space -> underscore, drop
 * non-alphanumeric characters. `"Roll No"` -> `roll_no`, `"first name"` ->
 * `first_name`.
 */
export function normalizeHeader(header: string): string {
    return header
        .trim()
        .toLowerCase()
        .replace(/[\s-]+/g, '_')
        .replace(/[^a-z0-9_]/g, '');
}

/**
 * Parse CSV text into a matrix of rows. Supports double-quoted fields with
 * embedded commas/quote-escapes. Blank rows are dropped.
 */
export function parseCsv(text: string): string[][] {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (inQuotes) {
            if (c === '"') {
                if (text[i + 1] === '"') {
                    field += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                field += c;
            }
        } else if (c === '"') {
            inQuotes = true;
        } else if (c === ',') {
            row.push(field);
            field = '';
        } else if (c === '\n') {
            row.push(field);
            field = '';
            rows.push(row);
            row = [];
        } else if (c !== '\r') {
            field += c;
        }
    }

    if (field.length > 0 || row.length > 0) {
        row.push(field);
        rows.push(row);
    }

    return rows.filter((r) => r.some((cell) => cell.trim().length > 0));
}

/** Convert a CSV matrix into objects keyed by normalized header. */
export function rowsToObjects(csvRows: string[][]): ImportRow[] {
    const [header, ...body] = csvRows;
    if (!header) return [];
    const keys = header.map((h) => normalizeHeader(h));
    return body.map((row) => {
        const obj: ImportRow = {};
        keys.forEach((key, idx) => {
            if (key) obj[key] = (row[idx] ?? '').trim();
        });
        return obj;
    });
}

/**
 * Parse JSON document text. Accepts either a top-level array of row objects or
 * an object with a `students` / `rows` array. Throws on malformed input.
 */
export function parseJsonRows(text: string): ImportRow[] {
    let data: unknown;
    try {
        data = JSON.parse(text);
    } catch {
        throw new Error('File is not valid JSON');
    }
    let arr: unknown;
    if (Array.isArray(data)) {
        arr = data;
    } else if (typeof data === 'object' && data !== null) {
        const o = data as Record<string, unknown>;
        arr = o.students ?? o.rows;
    }
    if (!Array.isArray(arr)) {
        throw new Error('JSON must be an array of student objects, or { students: [...] }');
    }
    return arr.map((entry) => {
        if (typeof entry !== 'object' || entry === null) {
            throw new Error('Each JSON entry must be an object');
        }
        const out: ImportRow = {};
        for (const [k, v] of Object.entries(entry as Record<string, unknown>)) {
            out[normalizeHeader(k)] = v == null ? '' : String(v).trim();
        }
        return out;
    });
}

/**
 * Best-effort PDF text extraction. Decompresses content streams (FlateDecode
 * via node:zlib) or falls back to raw latin1 text, then collects the arguments
 * of `(…) Tj` and `[…] TJ` text-show operators. Returns '' when nothing could
 * be extracted so the caller can present a clear error.
 */
export function extractPdfText(buffer: Uint8Array): string {
    const buf = Buffer.from(buffer);
    const latin = buf.toString('latin1');
    const out: string[] = [];
    const streamRe = /stream\r?\n([\s\S]*?)\r?\nendstream/g;
    let m: RegExpExecArray | null;

    while ((m = streamRe.exec(latin)) !== null) {
        let content: string;
        try {
            content = inflateRawSync(Buffer.from(m[1], 'latin1')).toString('utf8');
        } catch {
            content = m[1];
        }
        const textRe = /\(((?:[^()\\]|\\.)*)\)\s*Tj|\[((?:[^\[\]\\]|\\.)*)\]\s*TJ/g;
        let t: RegExpExecArray | null;
        while ((t = textRe.exec(content)) !== null) {
            const group = t[1] ?? t[2] ?? '';
            out.push(
                group.replace(/\\([nrt()\\])/g, (_s, ch: string) => {
                    if (ch === 'n') return '\n';
                    if (ch === 'r') return '\r';
                    if (ch === 't') return '\t';
                    return ch;
                })
            );
        }
    }

    return out.join('\n').trim();
}

/** Map of normalized header -> canonical student field. */
const FIELD_ALIASES: Record<string, keyof CanonicalStudentRow> = {
    firstname: 'firstName',
    first_name: 'firstName',
    name_first: 'firstName',
    given_name: 'firstName',
    givenname: 'firstName',
    lastname: 'lastName',
    last_name: 'lastName',
    name_last: 'lastName',
    surname: 'lastName',
    familyname: 'lastName',
    family_name: 'lastName',
    email: 'email',
    emailaddress: 'email',
    email_address: 'email',
    mail: 'email',
    phone: 'phone',
    mobile: 'phone',
    contact: 'phone',
    phonenumber: 'phone',
    phone_number: 'phone',
    dob: 'dob',
    dateofbirth: 'dob',
    date_of_birth: 'dob',
    birthdate: 'dob',
    birth_date: 'dob',
    gender: 'gender',
    sex: 'gender',
    category: 'category',
    caste: 'category',
    reservation: 'category',
    rollno: 'rollNo',
    roll_no: 'rollNo',
    enrollment: 'rollNo',
    admission_number: 'rollNo',
    enrollmentnumber: 'rollNo',
    program: 'programCode',
    programcode: 'programCode',
    program_code: 'programCode',
    course: 'programCode',
    programid: 'programId',
    program_id: 'programId',
    batch: 'batchName',
    batchname: 'batchName',
    batch_name: 'batchName',
    year: 'batchName',
    academicyear: 'batchName',
    batchid: 'batchId',
    batch_id: 'batchId',
    schoolid: 'schoolId',
    school_id: 'schoolId',
    status: 'status',
};

const EMPTY_CANONICAL: CanonicalStudentRow = {
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    dob: '',
    gender: '',
    category: '',
    rollNo: '',
    programCode: '',
    programId: '',
    batchName: '',
    batchId: '',
    schoolId: '',
    status: '',
};

/**
 * Map an imported row (normalized headers) onto canonical student fields. Only
 * recognized column aliases are mapped; unknown columns are ignored.
 */
export function normalizeStudentRow(row: ImportRow): CanonicalStudentRow {
    const out: CanonicalStudentRow = { ...EMPTY_CANONICAL };
    for (const [key, value] of Object.entries(row)) {
        const field = FIELD_ALIASES[key];
        if (field && value) out[field] = value;
    }
    return out;
}

/**
 * Parse an imported document's text into canonical student rows. `fmt` must be
 * 'csv' | 'json'. Throws a descriptive Error on unsupported/malformed input.
 */
export function parseStudentImport(text: string, fmt: 'csv' | 'json'): CanonicalStudentRow[] {
    const rows = fmt === 'csv' ? rowsToObjects(parseCsv(text)) : parseJsonRows(text);
    return rows.map((r) => normalizeStudentRow(r));
}
