import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi
} from 'vitest';

import type {
    RenderContext,
    WidgetItem
} from '../../types';
import { DEFAULT_SETTINGS } from '../../types/Settings';
import {
    AccountLabelWidget,
    accountMatches
} from '../AccountLabel';

const ORIGINAL_CLAUDE_CONFIG_DIR = process.env.CLAUDE_CONFIG_DIR;

let tempDir: string;

function item(customText: string | undefined, match?: string): WidgetItem {
    return {
        id: 'account-label',
        type: 'account-label',
        customText,
        metadata: match === undefined ? undefined : { match }
    };
}

function render(widgetItem: WidgetItem, context: RenderContext = {}): string | null {
    return new AccountLabelWidget().render(widgetItem, context, DEFAULT_SETTINGS);
}

function available(email: string): RenderContext {
    return { accountEmail: { status: 'available', email } };
}

describe('accountMatches', () => {
    it('matches a full email case-insensitively', () => {
        expect(accountMatches('Me@Work.com', 'me@work.com')).toBe(true);
        expect(accountMatches('me@work.com', 'other@work.com')).toBe(false);
    });

    it('matches an @domain suffix', () => {
        expect(accountMatches('@work.com', 'me@WORK.com')).toBe(true);
        expect(accountMatches('@work.com', 'me@home.com')).toBe(false);
    });

    it('does not let an @domain match a longer domain that only ends the same', () => {
        expect(accountMatches('@work.com', 'me@notwork.com')).toBe(false);
    });

    it('matches any entry of a comma-separated list', () => {
        expect(accountMatches('a@x.com, @work.com', 'me@work.com')).toBe(true);
        expect(accountMatches('a@x.com, @work.com', 'a@x.com')).toBe(true);
        expect(accountMatches('a@x.com, @work.com', 'b@x.com')).toBe(false);
    });

    it('treats a blank pattern as any account', () => {
        expect(accountMatches('', 'me@home.com')).toBe(true);
        expect(accountMatches(' , ', 'me@home.com')).toBe(true);
    });
});

describe('AccountLabelWidget', () => {
    beforeEach(() => {
        tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccstatusline-account-label-'));
        process.env.CLAUDE_CONFIG_DIR = tempDir;
    });

    afterEach(() => {
        fs.rmSync(tempDir, { recursive: true, force: true });
        if (ORIGINAL_CLAUDE_CONFIG_DIR === undefined) {
            delete process.env.CLAUDE_CONFIG_DIR;
        } else {
            process.env.CLAUDE_CONFIG_DIR = ORIGINAL_CLAUDE_CONFIG_DIR;
        }
        vi.restoreAllMocks();
    });

    it('shows its text when the live account matches', () => {
        expect(render(item(' WORK ', '@work.com'), available('me@work.com'))).toBe(' WORK ');
    });

    it('hides when the live account does not match', () => {
        expect(render(item(' WORK ', '@work.com'), available('me@home.com'))).toBeNull();
    });

    it('shows exactly one of two labels for each account', () => {
        const work = item(' WORK ', '@work.com');
        const personal = item(' PERSONAL ', '@home.com');

        expect([render(work, available('me@work.com')), render(personal, available('me@work.com'))])
            .toEqual([' WORK ', null]);
        expect([render(work, available('me@home.com')), render(personal, available('me@home.com'))])
            .toEqual([null, ' PERSONAL ']);
    });

    it('shows for any signed-in account when no pattern is set', () => {
        expect(render(item('ME'), available('me@home.com'))).toBe('ME');
    });

    it('falls back to .claude.json in CLAUDE_CONFIG_DIR without OAuth credentials', () => {
        fs.writeFileSync(
            path.join(tempDir, '.claude.json'),
            JSON.stringify({ oauthAccount: { emailAddress: 'me@work.com' } })
        );

        expect(render(item('WORK', '@work.com'), { accountEmail: { status: 'no-credentials' } })).toBe('WORK');
        expect(render(item('HOME', '@home.com'), { accountEmail: { status: 'no-credentials' } })).toBeNull();
    });

    it('hides rather than trust a stale .claude.json when the live lookup fails', () => {
        fs.writeFileSync(
            path.join(tempDir, '.claude.json'),
            JSON.stringify({ oauthAccount: { emailAddress: 'me@work.com' } })
        );

        expect(render(item('WORK', '@work.com'), { accountEmail: { status: 'unavailable' } })).toBeNull();
    });

    it('hides when no account can be found', () => {
        expect(render(item('ME'), {})).toBeNull();
    });

    it('hides when it has no text', () => {
        expect(render(item(undefined, '@work.com'), available('me@work.com'))).toBeNull();
        expect(render(item('', '@work.com'), available('me@work.com'))).toBeNull();
    });

    it('shows its text in the preview whatever the account', () => {
        expect(render(item('WORK', '@work.com'), { isPreview: true })).toBe('WORK');
    });

    it('uses keys the line editor does not already claim', () => {
        const lineEditorKeys = new Set(['a', 'i', 'd', 'k', 'c', ' ', 'r', 'm', 'x']);
        const keys = new AccountLabelWidget().getCustomKeybinds().map(kb => kb.key);

        expect(keys.filter(key => lineEditorKeys.has(key))).toEqual([]);
    });

    it('names its text and pattern in the editor', () => {
        const widget = new AccountLabelWidget();

        expect(widget.getEditorDisplay(item('WORK', '@work.com'))).toEqual({
            displayText: 'Account Label (WORK)',
            modifierText: '(@work.com)'
        });
        expect(widget.getEditorDisplay(item(undefined))).toEqual({
            displayText: 'Account Label (Empty)',
            modifierText: '(any account)'
        });
    });
});
