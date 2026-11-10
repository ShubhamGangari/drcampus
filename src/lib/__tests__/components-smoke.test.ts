import test from 'node:test';
import assert from 'node:assert/strict';

// Shared UI components (Task 7). Importing + checking they are renderable
// functions validates the barrel exports and module integrity without needing a
// browser/jsdom environment. Rendering is covered by manual/QA checks.
import { LoadingState, ErrorState, EmptyState } from '../../components/ui';
import { ModuleHelp } from '../../components/ui';

test('shared state components are exported as renderable components', () => {
    assert.equal(typeof LoadingState, 'function');
    assert.equal(typeof ErrorState, 'function');
    assert.equal(typeof EmptyState, 'function');
});

test('ModuleHelp is exported as a renderable component', () => {
    assert.equal(typeof ModuleHelp, 'function');
});
