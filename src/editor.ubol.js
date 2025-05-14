import {
    closeBrackets,
    closeBracketsKeymap,
} from '@codemirror/autocomplete';

import {
    defaultKeymap,
    history,
    historyKeymap,
} from '@codemirror/commands';

import {
    highlightSelectionMatches,
    openSearchPanel,
} from '@codemirror/search';

import {
    EditorView,
    crosshairCursor,
    drawSelection,
    highlightActiveLine,
    highlightActiveLineGutter,
    highlightSpecialChars,
    keymap,
    lineNumbers,
    placeholder,
    rectangularSelection,
} from '@codemirror/view';

import { EditorState } from '@codemirror/state';
import { bracketMatching } from '@codemirror/language';
import { oneDark } from "@codemirror/theme-one-dark";

export function createEditorState(initialContents, options = {}) {
    const extensions = [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightSpecialChars(),
        history(),
        drawSelection(),
        bracketMatching(),
        closeBrackets(),
        rectangularSelection(),
        crosshairCursor(),
        highlightActiveLine(),
        highlightSelectionMatches(),
        keymap.of([
            ...closeBracketsKeymap,
            ...defaultKeymap,
            ...historyKeymap,
        ]),
    ];

    if ( options.placeholder ) {
        extensions.push(placeholder(options.placeholder));
    }

    if (options.oneDark) {
        extensions.push(oneDark);
    }

    return EditorState.create({
        doc: initialContents,
        extensions
    });
}

export function createEditorView(state, parent) {
    return new EditorView({ state, parent });
}

export { openSearchPanel };
