import { syntaxHighlighting, HighlightStyle } from '@codemirror/language';
import { EditorView } from '@codemirror/view';
import { tags } from '@lezer/highlight';

const markupHighlightStyle = HighlightStyle.define([
  { tag: tags.tagName, color: 'var(--accent)' },
  { tag: tags.angleBracket, color: 'var(--muted)' },
  { tag: tags.attributeName, color: 'var(--foreground)' },
  { tag: tags.attributeValue, color: 'var(--success-soft-foreground, #15803d)' },
  { tag: tags.string, color: 'var(--success-soft-foreground, #15803d)' },
  { tag: tags.comment, color: 'var(--muted)', fontStyle: 'italic' },
  { tag: tags.keyword, color: 'var(--accent)' },
  { tag: tags.number, color: 'var(--warning-soft-foreground, #a16207)' },
  { tag: tags.propertyName, color: 'var(--accent)' },
  { tag: tags.operator, color: 'var(--muted)' },
]);

export const mailTemplateEditorTheme = [
  syntaxHighlighting(markupHighlightStyle),
  EditorView.theme({
    '&': { color: 'var(--foreground)', backgroundColor: 'var(--background)' },
    '.cm-gutters': {
      color: 'var(--muted)',
      backgroundColor: 'var(--surface-secondary, var(--background))',
      border: 'none',
    },
    '.cm-activeLine, .cm-activeLineGutter': {
      backgroundColor: 'color-mix(in srgb, var(--accent) 9%, transparent)',
    },
    '.cm-selectionBackground': {
      backgroundColor: 'color-mix(in srgb, var(--accent) 24%, transparent)',
    },
    '&.cm-focused .cm-selectionBackground': {
      backgroundColor: 'color-mix(in srgb, var(--accent) 28%, transparent)',
    },
    '.cm-cursor': { borderLeftColor: 'var(--foreground)' },
  }),
];
