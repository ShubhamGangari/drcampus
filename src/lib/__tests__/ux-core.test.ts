import test from 'node:test';
import assert from 'node:assert/strict';

import {
    COMMAND_FEATURES,
    buildCommandIndex,
    commandVisible,
    type UxCommandItem,
} from '../ux-core';
import {
    PERMISSION_CATALOG,
    hasEffectivePermission,
} from '../perms';

// Derive the full set of valid catalog permission keys (single source of truth).
const CATALOG_KEYS = new Set<string>(
    PERMISSION_CATALOG.flatMap((area) => area.permissions.map((p) => p.key))
);

test('buildCommandIndex: returns a stable group list in declaration order', () => {
    const expectedKeys = COMMAND_FEATURES
        .filter((f) => f.items.length > 0)
        .map((f) => f.key);
    assert.deepEqual(buildCommandIndex().map((g) => g.key), expectedKeys);
});

test('buildCommandIndex: covers every Batch A–D module plus Batch E modules', () => {
    const keys = new Set(buildCommandIndex().map((g) => g.key));
    for (const key of [
        'placement',
        'internships',
        'alumniJobs',
        'mentorship',
        'parent',
        'reportsCenter',
        'idcards',
    ]) {
        assert.ok(keys.has(key), `missing group key: ${key}`);
    }
});

test('buildCommandIndex: every item lists required permissions and all are valid catalog keys', () => {
    for (const group of buildCommandIndex()) {
        for (const item of group.items) {
            assert.ok(Array.isArray(item.permissions), `${item.label} must carry a permissions array`);
            for (const permission of item.permissions) {
                assert.ok(CATALOG_KEYS.has(permission), `${item.label} uses unknown permission: ${permission}`);
            }
        }
    }
});

test('buildCommandIndex: items within a group are sorted by label', () => {
    for (const group of buildCommandIndex()) {
        const labels = group.items.map((i) => i.label);
        const sorted = [...labels].sort((a, b) => a.localeCompare(b));
        assert.deepEqual(labels, sorted, `group ${group.key} items are not sorted`);
    }
});

test('buildCommandIndex: drops empty groups', () => {
    const index = buildCommandIndex([
        { key: 'empty', label: 'Empty', items: [] },
        {
            key: 'filled',
            label: 'Filled',
            items: [{ label: 'A', href: '/a', permissions: [] }],
        },
    ]);
    assert.deepEqual(index.map((g) => g.key), ['filled']);
});

test('buildCommandIndex: preserves declaration order of non-empty groups', () => {
    const index = buildCommandIndex([
        {
            key: 'b',
            label: 'B',
            items: [{ label: 'B1', href: '/b1', permissions: [] }],
        },
        {
            key: 'a',
            label: 'A',
            items: [{ label: 'A1', href: '/a1', permissions: [] }],
        },
    ]);
    assert.deepEqual(index.map((g) => g.key), ['b', 'a']);
});

test('commandVisible: public commands (empty permissions) are always visible', () => {
    const item: UxCommandItem = { label: 'X', href: '/x', permissions: [] };
    assert.equal(commandVisible(item, [], hasEffectivePermission), true);
    assert.equal(commandVisible(item, ['report.view'], hasEffectivePermission), true);
});

test('commandVisible: hidden when none of the required permissions are held', () => {
    const item: UxCommandItem = {
        label: 'X',
        href: '/x',
        permissions: ['placement.manage'],
    };
    assert.equal(commandVisible(item, ['placement.view'], hasEffectivePermission), false);
    assert.equal(commandVisible(item, [], hasEffectivePermission), false);
});

test('commandVisible: visible when any required permission is held', () => {
    const item: UxCommandItem = {
        label: 'X',
        href: '/x',
        permissions: ['placement.view', 'placement.manage'],
    };
    assert.equal(commandVisible(item, ['placement.view'], hasEffectivePermission), true);
    assert.equal(commandVisible(item, ['placement.manage'], hasEffectivePermission), true);
});
