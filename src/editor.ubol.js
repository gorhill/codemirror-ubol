import {
    Compartment,
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
    searchKeymap,
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

import { autocompletion } from '@codemirror/autocomplete';

// Theme
import { oneDark } from '@codemirror/theme-one-dark';

// Language
import { yaml } from '@codemirror/lang-yaml';

/******************************************************************************/

function createEditorState(text, options = {}) {
    const keymaps = [
        ...defaultKeymap,
        ...historyKeymap,
        ...searchKeymap,
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
        undoRedo.of(history()),
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

    if ( options.dnrRules ) {
        extensions.push(
            indentOnInput(),
            indentUnit.of('  '),
            syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
            yaml(),
        );
    }

    if ( options.autocompletion ) {
        extensions.push(autocompletion(options.autocompletion));
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

// https://discuss.codemirror.net/t/codemirror-6-cm-clearhistory-equivalent/2851/10

function resetUndoRedo(view) {
    view.dispatch({
        effects: [ undoRedo.reconfigure([]) ],
    });
    view.dispatch({
        effects: [ undoRedo.reconfigure([history()]) ],
    });
}

const undoRedo = new Compartment();

/******************************************************************************/

function lineErrorAdd(view, indices) {
    const config = perViewConfig.get(view);
    if ( config === undefined ) { return; }
    const { lineErrorDecoration } = config;
    if ( lineErrorDecoration === undefined ) { return; }
    const decorations = [];
    for ( const i of indices ) {
        const line = view.state.doc.line(i);
        decorations.push(lineErrorDecoration.range(line.from));
    }
    view.dispatch({ effects: lineErrorEffect.of(decorations) });
}

function lineErrorClear(view, lineStart, lineEnd) {
    const config = perViewConfig.get(view);
    if ( config === undefined ) { return; }
    const { lineErrorDecoration } = config;
    if ( lineErrorDecoration === undefined ) { return; }
    const { doc } = view.state;
    const start = doc.line(lineStart);
    const end = doc.line(lineEnd);
    const from = start.from;
    const to = end.to;
    view.dispatch({
        effects: lineOkEffect.of((a, b) => a > to || b < from)
    });
}

const lineErrorEffect = StateEffect.define();
const lineOkEffect = StateEffect.define();

/******************************************************************************/

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
    lineErrorAdd,
    lineErrorClear,
    resetUndoRedo,
};
