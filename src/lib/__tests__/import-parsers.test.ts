import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
    normalizeHeader,
    parseCsv,
    rowsToObjects,
    parseJsonRows,
    extractPdfText,
    normalizeStudentRow,
    parseStudentImport,
    type ImportRow,
} from '../import-parsers';

test('normalizeHeader lowercases, dashes/space -> underscore, strips punctuation', () => {
    assert.equal(normalizeHeader('Roll No'), 'roll_no');
    assert.equal(normalizeHeader('First Name'), 'first_name');
    assert.equal(normalizeHeader('  Date-of-Birth  '), 'date_of_birth');
    assert.equal(normalizeHeader('email'), 'email');
    assert.equal(normalizeHeader('Program Code!'), 'program_code');
});

test('parseCsv parses quoted fields with embedded commas and quote escapes', () => {
    const csv = [
        'firstName,lastName,email',
        '"Kumar, Aakash","Singh","a@b.com"',
        'Priya,Sharma,"p@x.com"',
        '',
    ].join('\n');
    const rows = parseCsv(csv);
    assert.equal(rows.length, 3); // header + 2 data rows
    assert.deepEqual(rows[1], ['Kumar, Aakash', 'Singh', 'a@b.com']);
    assert.deepEqual(rows[2], ['Priya', 'Sharma', 'p@x.com']);
});

test('parseCsv handles escaped double quotes', () => {
    const rows = parseCsv('name,note\n"O""Brien","said ""hi"""');
    assert.deepEqual(rows[1], ['O"Brien', 'said "hi"']);
});

test('parseCsv drops blank rows', () => {
    const rows = parseCsv('a,b\n1,2\n\n,\n3,4\n');
    assert.equal(rows.length, 3); // header + 2 data rows
});

test('rowsToObjects maps keys via normalizeHeader and trims values', () => {
    const rows = rowsToObjects([
        ['First Name', 'Roll No', 'Email'],
        [' Aakash ', '25CS101', 'a@b.com'],
    ]);
    assert.equal(rows.length, 1);
    assert.deepEqual(rows[0], {
        first_name: 'Aakash',
        roll_no: '25CS101',
        email: 'a@b.com',
    });
});

test('rowsToObjects returns [] when no header', () => {
    assert.deepEqual(rowsToObjects([]), []);
});

test('parseJsonRows accepts a top-level array', () => {
    const rows = parseJsonRows(JSON.stringify([{ 'First Name': 'A', email: 'a@b.com' }]));
    assert.equal(rows.length, 1);
    assert.deepEqual(rows[0], { first_name: 'A', email: 'a@b.com' });
});

test('parseJsonRows accepts { students: [...] } and { rows: [...] }', () => {
    const rows = parseJsonRows(JSON.stringify({ students: [{ email: 'a@b.com' }] }));
    assert.equal(rows.length, 1);
    assert.equal(rows[0].email, 'a@b.com');
});

test('parseJsonRows throws on malformed JSON or non-array shape', () => {
    assert.throws(() => parseJsonRows('not json'), /not valid JSON/);
    assert.throws(() => parseJsonRows(JSON.stringify({ foo: 1 })), /array of student objects/);
});

test('extractPdfText returns empty string for non-text/no-stream input', () => {
    assert.equal(extractPdfText(Buffer.from('%PDF-1.4\n%%EOF')), '');
});

test('normalizeStudentRow maps aliases and ignores unknown columns', () => {
    const row: ImportRow = {
        first_name: 'A',
        surname: 'B',
        program: 'BTech-CSE',
        batch_name: '2026',
        unknown_col: 'ignored',
    };
    const c = normalizeStudentRow(row);
    assert.equal(c.firstName, 'A');
    assert.equal(c.lastName, 'B');
    assert.equal(c.programCode, 'BTech-CSE');
    assert.equal(c.batchName, '2026');
    // Unknown columns are dropped entirely (not copied to the canonical row).
    assert.equal(Object.hasOwn(c, 'unknownCol'), false);
    assert.equal(Object.keys(c).length, 14); // CanonicalStudentRow has exactly 14 fields.
});

test('normalizeStudentRow leaves missing fields empty', () => {
    const c = normalizeStudentRow({});
    assert.equal(c.firstName, '');
    assert.equal(c.email, '');
    assert.equal(c.status, '');
});

test('parseStudentImport normalizes CSV rows end-to-end', () => {
    const csv = [
        'First Name,Last Name,Email,Roll No,Program,Batch',
        'Aa,Ka,aa@b.com,25CS101,BTech-CSE,2026',
    ].join('\n');
    const rows = parseStudentImport(csv, 'csv');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].firstName, 'Aa');
    assert.equal(rows[0].lastName, 'Ka');
    assert.equal(rows[0].email, 'aa@b.com');
    assert.equal(rows[0].rollNo, '25CS101');
    assert.equal(rows[0].programCode, 'BTech-CSE');
    assert.equal(rows[0].batchName, '2026');
});

test('parseStudentImport normalizes JSON rows end-to-end', () => {
    const json = JSON.stringify([{ email: 'x@y.com', firstName: 'R', last_name: 'T' }]);
    const rows = parseStudentImport(json, 'json');
    assert.equal(rows.length, 1);
    assert.equal(rows[0].email, 'x@y.com');
    assert.equal(rows[0].firstName, 'R');
    assert.equal(rows[0].lastName, 'T');
});
