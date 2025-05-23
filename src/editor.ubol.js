import {
    bracketMatching,
    defaultHighlightStyle,
    indentOnInput,
    indentUnit,
    syntaxHighlighting,
} from '@codemirror/language';

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
import { oneDark } from '@codemirror/theme-one-dark';
import { yaml } from '@codemirror/lang-yaml';

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

    if ( options.updateListener ) {
        extensions.push(EditorView.updateListener.of(options.updateListener));
    }

    if ( options.placeholder ) {
        extensions.push(placeholder(options.placeholder));
    }

    if (options.oneDark) {
        extensions.push(oneDark);
    }

    if ( options.yaml ) {
        extensions.push(
            indentOnInput(),
            indentUnit.of('  '),
            syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
            yaml(),
        );
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
