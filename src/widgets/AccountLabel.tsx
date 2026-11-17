import {
    Box,
    Text,
    useInput
} from 'ink';
import React from 'react';

import type { RenderContext } from '../types/RenderContext';
import type { Settings } from '../types/Settings';
import type {
    CustomKeybind,
    Widget,
    WidgetEditorDisplay,
    WidgetEditorProps,
    WidgetItem
} from '../types/Widget';

import { resolveAccountEmail } from './shared/account-email';
import { removeMetadataKeys } from './shared/metadata';
import { useTextCursor } from './shared/text-cursor';

const MATCH_METADATA_KEY = 'match';
const EDIT_TEXT_ACTION = 'edit-text';
const EDIT_MATCH_ACTION = 'edit-match';

function getMatchPattern(item: WidgetItem): string {
    return item.metadata?.[MATCH_METADATA_KEY]?.trim() ?? '';
}

// A pattern is a comma-separated list of full emails or `@domain` suffixes,
// compared case-insensitively. An empty pattern matches any signed-in account.
export function accountMatches(pattern: string, email: string): boolean {
    const entries = pattern.split(',')
        .map(entry => entry.trim().toLowerCase())
        .filter(entry => entry.length > 0);
    if (entries.length === 0) {
        return true;
    }

    const address = email.trim().toLowerCase();
    return entries.some(entry => entry.startsWith('@')
        ? address.endsWith(entry)
        : address === entry);
}

function withMatchPattern(item: WidgetItem, pattern: string): WidgetItem {
    const trimmed = pattern.trim();
    if (trimmed.length === 0) {
        return removeMetadataKeys(item, [MATCH_METADATA_KEY]);
    }
    return { ...item, metadata: { ...item.metadata, [MATCH_METADATA_KEY]: trimmed } };
}

export class AccountLabelWidget implements Widget {
    getDefaultColor(): string { return 'white'; }
    getDescription(): string { return 'Shows custom text only while the signed-in Claude account matches an email or @domain'; }
    getDisplayName(): string { return 'Account Label'; }
    getCategory(): string { return 'Session'; }

    getEditorDisplay(item: WidgetItem): WidgetEditorDisplay {
        const text = item.customText ?? 'Empty';
        const pattern = getMatchPattern(item);
        return {
            displayText: `${this.getDisplayName()} (${text})`,
            modifierText: `(${pattern.length > 0 ? pattern : 'any account'})`
        };
    }

    render(item: WidgetItem, context: RenderContext, settings: Settings): string | null {
        const text = item.customText ?? '';
        if (text.length === 0) {
            return null;
        }
        if (context.isPreview) {
            return text;
        }

        const email = resolveAccountEmail(context);
        if (email === null || !accountMatches(getMatchPattern(item), email)) {
            return null;
        }
        return text;
    }

    getCustomKeybinds(): CustomKeybind[] {
        return [
            { key: 'e', label: '(e)dit text', action: EDIT_TEXT_ACTION },
            { key: 'w', label: '(w)hich account', action: EDIT_MATCH_ACTION }
        ];
    }

    renderEditor(props: WidgetEditorProps): React.ReactElement {
        return <AccountLabelEditor {...props} />;
    }

    supportsRawValue(): boolean { return false; }
    supportsColors(item: WidgetItem): boolean { return true; }
}

const AccountLabelEditor: React.FC<WidgetEditorProps> = ({ widget, onComplete, onCancel, action }) => {
    const isMatchMode = action === EDIT_MATCH_ACTION;
    const { getText, display, handleInput } = useTextCursor(
        isMatchMode ? getMatchPattern(widget) : (widget.customText ?? '')
    );

    useInput((input, key) => {
        if (key.return) {
            onComplete(isMatchMode
                ? withMatchPattern(widget, getText())
                : { ...widget, customText: getText() });
        } else if (key.escape) {
            onCancel();
        } else {
            handleInput(input, key);
        }
    });

    return (
        <Box flexDirection='column'>
            <Text>{`${isMatchMode ? 'Match account (email or @domain, comma-separated; blank = any)' : 'Enter label text'}: ${display}`}</Text>
            <Text dimColor>←→ move cursor, Ctrl+←→ jump to start/end, Enter save, ESC cancel</Text>
        </Box>
    );
};
