import {
    EditorState,
    StateEffect,
    StateField,
} from '@codemirror/state';

import {
    bracketMatching,
    defaultHighlightStyle,
    indentOnInput,
    indentUnit,
    syntaxHighlighting,
} from '@codemirror/language';

import {
    defaultKeymap,
    history,
    historyKeymap,
} from '@codemirror/commands';

import {
    highlightSelectionMatches,
} from '@codemirror/search';

import {
    Decoration,
    EditorView,
    drawSelection,
    highlightActiveLine,
    highlightActiveLineGutter,
    highlightSpecialChars,
    keymap,
    lineNumbers,
    placeholder,
} from '@codemirror/view';

// Theme
import { oneDark } from '@codemirror/theme-one-dark';

// Language
import { yaml } from '@codemirror/lang-yaml';

/******************************************************************************/

function createEditorState(text, options = {}) {
    const keymaps = [
        ...defaultKeymap,
        ...historyKeymap,
    ];

    const { saveListener } = options;
    if ( saveListener ) {
        keymaps.push({
            key: 'Ctrl-s',
            run({ state }) {
                saveListener(state);
                return true;
            }
        });
    }

    const extensions = [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightSpecialChars(),
        history(),
        drawSelection(),
        bracketMatching(),
        highlightActiveLine(),
        highlightSelectionMatches(),
        keymap.of(keymaps),
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

    const lineErrorExtension = StateField.define({
        create() { return Decoration.none; },
        update(value, transaction) {
            value = value.map(transaction.changes);
            for ( const effect of transaction.effects ) {
                if ( effect.is(lineErrorEffect) ) {
                    value = value.update({ add: effect.value });
                } else if ( effect.is(lineOkEffect) ) {
                    value = value.update({ filter: effect.value });
                }
            }
            return value;
        },
        provide: f => EditorView.decorations.from(f),
    });
    extensions.push(lineErrorExtension);

    return EditorState.create({ doc: text, extensions });
}

/******************************************************************************/

function lineErrorAt(view, indices) {
    const config = perViewConfig.get(view);
    if ( config === undefined ) { return; }
    const { lineErrorDecoration } = config;
    if ( lineErrorDecoration === undefined ) { return; }
    const decorations = [];
    for ( const i of indices ) {
        const line = view.state.doc.line(i+1);
        decorations.push(lineErrorDecoration.range(line.from));
    }
    view.dispatch({ effects: lineErrorEffect.of(decorations) });
}

function lineErrorClear(view) {
    const config = perViewConfig.get(view);
    if ( config === undefined ) { return; }
    const { lineErrorDecoration } = config;
    if ( lineErrorDecoration === undefined ) { return; }
    view.dispatch({ effects: lineOkEffect.of(( ) => false) });
}

/******************************************************************************/

const lineErrorEffect = StateEffect.define();
const lineOkEffect = StateEffect.define();

const perViewConfig = new WeakMap();

export function createEditorView(options, parent) {
    const state = createEditorState('', options);
    const view = new EditorView({ state, parent });
    const config = {};
    perViewConfig.set(view, config);
    if ( options.lineError ) {
        config.lineErrorDecoration = Decoration.line({ class: options.lineError });
    }
    return view;
}

export {
    lineErrorAt,
    lineErrorClear,
};
