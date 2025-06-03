import {
    Compartment,
    EditorState,
    StateEffect,
    StateField,
} from '@codemirror/state';

import {
    StreamLanguage,
    bracketMatching,
    defaultHighlightStyle,
    foldAll,
    foldGutter,
    foldKeymap,
    foldService,
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
    RegExpCursor,
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
    hoverTooltip,
    keymap,
    lineNumbers,
    placeholder,
    showPanel,
} from '@codemirror/view';

import { MergeView } from '@codemirror/merge';
import { autocompletion } from '@codemirror/autocomplete';

// Theme
import { oneDark } from '@codemirror/theme-one-dark';

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

    if ( options.foldService ) {
        keymaps.push(...foldKeymap);
    }

    const extensions = [
        highlightActiveLineGutter(),
        highlightSpecialChars(),
        undoRedo.of(history()),
        drawSelection(),
        bracketMatching(),
        highlightActiveLine(),
        highlightSelectionMatches(),
        keymap.of(keymaps),
    ];

    let gutterConfig;
    if ( options.gutterClick ) {
        gutterConfig = {
            domEventHandlers: {
                click: options.gutterClick,
            }
        };
    }
    extensions.push(lineNumbers(gutterConfig));

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
            summaryPanelExtension,
            feedbackPanelExtension,
        );
    }

    if ( options.lineError ) {
        extensions.push(lineErrorExtension);
    }

    if ( options.spanError ) {
        extensions.push(spanErrorExtension);
    }

    if ( options.autocompletion ) {
        extensions.push(autocompletion(options.autocompletion));
    }

    if ( options.hoverTooltip ) {
        extensions.push(hoverTooltip(options.hoverTooltip));
    }

    if ( options.streamParser ) {
        extensions.push(
            StreamLanguage.define(options.streamParser),
        );
    }

    if ( options.foldService ) {
        extensions.push(
            foldService.of(options.foldService),
            foldGutter({
                closedText: '\u25b6',
                openText: '\u25bc',
                domEventHandlers: {
                    click: view => {
                        view.focus();
                    }
                },
            }),
        );
    }

    return EditorState.create({ doc: text, extensions });
}

/******************************************************************************/

// https://discuss.codemirror.net/t/codemirror-6-cm-clearhistory-equivalent/2851/10

export function resetUndoRedo(view) {
    view.dispatch({
        effects: [ undoRedo.reconfigure([]) ],
    });
    view.dispatch({
        effects: [ undoRedo.reconfigure([history()]) ],
    });
}

const undoRedo = new Compartment();

/******************************************************************************/

const spanErrorEffect = StateEffect.define();
const spanOkEffect = StateEffect.define();

const spanErrorExtension = StateField.define({
    create() { return Decoration.none; },
    update(value, transaction) {
        value = value.map(transaction.changes);
        for ( const effect of transaction.effects ) {
            if ( effect.is(spanErrorEffect) ) {
                value = value.update({ add: effect.value });
            } else if ( effect.is(spanOkEffect) ) {
                value = value.update({ filter: effect.value });
            }
        }
        return value;
    },
    provide: f => EditorView.decorations.from(f),
});

export function spanErrorAdd(view, from, to, tooltip) {
    const spec = { class: 'badmark' };
    if ( tooltip ) {
        spec.attributes = { 'data-tooltip': tooltip };
    }
    const decoration = Decoration.mark(spec);
    view.dispatch({
        effects: spanErrorEffect.of([ decoration.range(from, to) ])
    });
}

export function spanErrorClear(view, lineStart, lineEnd) {
    const { doc } = view.state;
    const start = doc.line(lineStart);
    const end = doc.line(lineEnd);
    const from = start.from;
    const to = end.to;
    view.dispatch({
        effects: spanOkEffect.of((a, b) => a > to || b < from)
    });
}

/******************************************************************************/

const lineErrorEffect = StateEffect.define();
const lineOkEffect = StateEffect.define();

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

export function lineErrorAdd(view, indices) {
    const decoration = Decoration.line({ class: 'badline' });
    const decorations = [];
    for ( const i of indices ) {
        const line = view.state.doc.line(i);
        decorations.push(decoration.range(line.from));
    }
    view.dispatch({ effects: lineErrorEffect.of(decorations) });
}

export function lineErrorClear(view, lineStart, lineEnd) {
    const { doc } = view.state;
    const start = doc.line(lineStart);
    const end = doc.line(lineEnd);
    const from = start.from;
    const to = end.to;
    view.dispatch({
        effects: lineOkEffect.of((a, b) => a > to || b < from)
    });
}

/******************************************************************************/

function createInfoPanel(view, field, effect) {
    const config = view.state.field(field);
    if ( config instanceof Object === false ) { return; }
    const template = document.querySelector(`template${config.template}`);
    if ( template === null ) { return; }
    const fragment = template.content.cloneNode(true);
    const dom = fragment.querySelector(config.template);
    if ( dom === null ) { return; }
    const info = dom.querySelector('.info');
    if ( info === null ) { return; }
    info.textContent = config.text;
    const out = { dom, top: true };
    if ( dom.querySelector('.close') !== null ) {
        const close = dom.querySelector('.close');
        out.mount = ( ) => {
            close.addEventListener('click', ( ) => {
                showInfoPanel(view, effect, null);
            }, { once: true });
        };
    }
    return out;
}

function showInfoPanel(view, effect, val) {
    view.dispatch({ effects: effect.of(null) });
    if ( val === null ) { return; }
    if ( typeof val.text !== 'string' ) { return; }
    if ( val.text === '' ) { return; }
    view.dispatch({ effects: effect.of(val) });
}

/******************************************************************************/

const summaryPanelEffect = StateEffect.define()

const summaryPanelExtension = StateField.define({
    create() { return null; },
    update(value, transaction) {
        for ( const effect of transaction.effects ) {
            if ( effect.is(summaryPanelEffect) === false ) { continue; }
            value = effect.value;
        }
        return value;
    },
    provide: f => showPanel.from(f, value =>
        value instanceof Object ? createSummaryPanel : null
    ),
});

function createSummaryPanel(view) {
    return createInfoPanel(view, summaryPanelExtension, summaryPanelEffect);
}

export function showSummaryPanel(view, val) {
    showInfoPanel(view, summaryPanelEffect, val);
}

/******************************************************************************/

const feedbackPanelEffect = StateEffect.define()

const feedbackPanelExtension = StateField.define({
    create() { return null; },
    update(value, transaction) {
        for ( const effect of transaction.effects ) {
            if ( effect.is(feedbackPanelEffect) === false ) { continue; }
            value = effect.value;
        }
        return value;
    },
    provide: f => showPanel.from(f, value =>
        value instanceof Object ? createFeedbackPanel : null
    ),
});

function createFeedbackPanel(view) {
    return createInfoPanel(view, feedbackPanelExtension, feedbackPanelEffect);
}

export function showFeedbackPanel(view, val) {
    showInfoPanel(view, feedbackPanelEffect, val);
}

/******************************************************************************/

function findAll(view, regex, from, to) {
    const { doc } = view.state;
    if ( from === undefined ) {
        from = 0;
    } else if ( to === undefined ) {
        to = doc.length;
    }
    const out = [];
    const cursor = new RegExpCursor(doc, regex, null, from, to);
    for (;;) {
        cursor.next();
        if ( cursor.done ) { break; }
        out.push(cursor.value);         
    }
    return out;
}

/******************************************************************************/

export function createEditorView(options, parent) {
    const state = createEditorState(options.text, options);
    return new EditorView({ state, parent });
}

/******************************************************************************/

// https://github.com/codemirror/merge?tab=readme-ov-file

export function createMergeView(options, parent) {
    const basicSetup = [
        lineNumbers(),
        highlightActiveLineGutter(),
        highlightSpecialChars(),
        history(),
        foldGutter(),
        drawSelection(),
        EditorView.lineWrapping,
        EditorState.allowMultipleSelections.of(true),
        indentOnInput(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        bracketMatching(),
        autocompletion(),
        highlightActiveLine(),
        highlightSelectionMatches(),
        keymap.of([
            ...defaultKeymap,
            ...searchKeymap,
            ...historyKeymap,
            ...foldKeymap,
        ]),
    ];

    const a = {
        doc: options.aDoc || '',
        extensions: basicSetup,
    };
    if ( options.aUpdateListener ) {
        a.extensions.push(EditorView.updateListener.of(options.aUpdateListener));
    };

    return new MergeView({
        a,
        b: {
            doc: options.bDoc || '',
            extensions: [
                basicSetup,
                EditorView.editable.of(false),
                EditorState.readOnly.of(true),
            ]
        },
        parent,
    })
};

/******************************************************************************/

export {
    findAll,
    foldAll,
};
