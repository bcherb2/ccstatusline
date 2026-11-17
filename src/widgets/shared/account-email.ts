import * as fs from 'node:fs';

import type { RenderContext } from '../../types/RenderContext';
import { getClaudeJsonPath } from '../../utils/claude-settings';

interface ClaudeJson { oauthAccount?: { emailAddress?: string } }

function readClaudeJsonAccountEmail(): string | null {
    try {
        const content = fs.readFileSync(getClaudeJsonPath(), 'utf-8');
        const data = JSON.parse(content) as ClaudeJson;
        const email = data.oauthAccount?.emailAddress;

        return typeof email === 'string' && email.length > 0 ? email : null;
    } catch {
        return null;
    }
}

// The email of the signed-in account, or null when it cannot be told.
// .claude.json's oauthAccount is written at login and can still name a
// previous account after the credentials change (#538). A failed lookup for
// an existing login must not fall back to that snapshot.
export function resolveAccountEmail(context: RenderContext): string | null {
    if (context.accountEmail?.status === 'unavailable') {
        return null;
    }
    return context.accountEmail?.status === 'available'
        ? context.accountEmail.email
        : readClaudeJsonAccountEmail();
}

// Widget types that need fetchAccountEmail() run before rendering
export const ACCOUNT_EMAIL_WIDGET_TYPES: ReadonlySet<string> = new Set(['claude-account-email', 'account-label']);
