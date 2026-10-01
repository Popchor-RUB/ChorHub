import { Compartment, EditorState } from '@codemirror/state';
import { indentUnit } from '@codemirror/language';
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
import { html } from '@codemirror/lang-html';
import { EditorView, lineNumbers, highlightActiveLine, highlightActiveLineGutter, keymap } from '@codemirror/view';
import { useEffect, useRef } from 'react';
import type { MailTemplateKey } from '../../../types';
import { mailTemplateEditorTheme } from './mailTemplateEditorTheme';
import { mailTemplateHighlighting } from './mailTemplateHighlighting';
import './mail-template-markup-editor.css';

interface MailTemplateMarkupEditorProps {
  id: string;
  label: string;
  labelId: string;
  descriptionId: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
  templateKey: MailTemplateKey;
}

interface EditorInstance {
  view: EditorView;
  history: Compartment;
  editable: Compartment;
  attributes: Compartment;
}

function contentAttributes(id: string, label: string, labelId: string, descriptionId: string, disabled: boolean) {
  return EditorView.contentAttributes.of({
    id,
    role: 'textbox',
    'aria-label': label,
    'aria-labelledby': labelId,
    'aria-describedby': descriptionId,
    'aria-multiline': 'true',
    'aria-readonly': String(disabled),
    'aria-disabled': String(disabled),
    'aria-keyshortcuts': 'Ctrl+M Alt+Shift+M',
    'data-testid': 'admin-mail-template-html',
    autocapitalize: 'off',
    autocomplete: 'off',
    autocorrect: 'off',
    spellcheck: 'false',
  });
}

export function MailTemplateMarkupEditor({ id, label, labelId, descriptionId, value, onChange, disabled, templateKey }: MailTemplateMarkupEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<EditorInstance | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    const historyCompartment = new Compartment();
    const editableCompartment = new Compartment();
    const attributesCompartment = new Compartment();
    const extensions = [
      lineNumbers(),
      EditorView.lineWrapping,
      highlightActiveLine(),
      highlightActiveLineGutter(),
      html({ autoCloseTags: false }),
      indentUnit.of('  '),
      historyCompartment.of(history()),
      editableCompartment.of([EditorState.readOnly.of(disabled), EditorView.editable.of(!disabled)]),
      attributesCompartment.of(contentAttributes(id, label, labelId, descriptionId, disabled)),
      keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
      mailTemplateHighlighting,
      mailTemplateEditorTheme,
      EditorView.updateListener.of((update) => {
        if (update.docChanged) onChangeRef.current(update.state.doc.toString());
      }),
    ];

    const view = new EditorView({
      state: EditorState.create({ doc: value, extensions }),
      parent: host,
    });
    instanceRef.current = { view, history: historyCompartment, editable: editableCompartment, attributes: attributesCompartment };

    return () => {
      view.destroy();
      instanceRef.current = null;
    };
    // Template switch intentionally remounts the view and clears its undo history.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templateKey, id, label, labelId, descriptionId]);

  useEffect(() => {
    const instance = instanceRef.current;
    if (!instance) return;
    const currentValue = instance.view.state.doc.toString();
    if (currentValue !== value) {
      instance.view.dispatch({
        changes: { from: 0, to: currentValue.length, insert: value },
        effects: instance.history.reconfigure([]),
      });
      instance.view.dispatch({ effects: instance.history.reconfigure(history()) });
    }
  }, [value, templateKey]);

  useEffect(() => {
    const instance = instanceRef.current;
    if (!instance) return;
    instance.view.dispatch({
      effects: [
        instance.editable.reconfigure([EditorState.readOnly.of(disabled), EditorView.editable.of(!disabled)]),
        instance.attributes.reconfigure(contentAttributes(id, label, labelId, descriptionId, disabled)),
      ],
    });
  }, [disabled, id, label, labelId, descriptionId]);

  return <div className="mail-template-markup-editor" ref={hostRef} aria-label={label} />;
}
