// Cross-platform test runner for CampusERP unit tests.
// Enumerates src/lib/__tests__/*.test.ts and runs them via tsx + node:test.
// (Node 20's built-in --test CLI does not expand globs or match .test.ts on Windows cmd.)
"use strict";

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const dir = path.join("src", "lib", "__tests__");

const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".test.ts"))
    .sort()
    .map((f) => path.join(dir, f));

if (files.length === 0) {
    console.error(`No .test.ts files found in ${dir}`);
    process.exit(1);
}

const quoted = files.map((f) => `"${f}"`).join(" ");

try {
    execSync(`npx tsx --test ${quoted}`, {
        stdio: "inherit",
        shell: true,
    });
} catch (err) {
    process.exit(1);
}
