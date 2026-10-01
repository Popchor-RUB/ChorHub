import { Decoration } from '@codemirror/view';
import type { Range } from '@codemirror/state';
import { ViewPlugin } from '@codemirror/view';
import type { EditorView } from '@codemirror/view';

const handlebarsPattern = /\{\{\{[\s\S]*?\}\}\}|\{\{[\s\S]*?\}\}/g;

function createDecorations(view: EditorView) {
  const source = view.state.doc.toString();
  const ranges: Range<Decoration>[] = [];

  for (const match of source.matchAll(handlebarsPattern)) {
    const from = match.index;
    const token = match[0];
    const classes = ['cm-handlebars'];
    if (token.startsWith('{{{')) classes.push('cm-handlebars-triple');
    if (/^\{\{[#/^]|^\{\{\s*else\b/.test(token)) classes.push('cm-handlebars-block');
    ranges.push(Decoration.mark({ class: classes.join(' ') }).range(from, from + token.length));
  }

  return Decoration.set(ranges, true);
}

export const mailTemplateHighlighting = ViewPlugin.define((view) => {
  let decorations = createDecorations(view);
  return {
    get decorations() {
      return decorations;
    },
    update(update) {
      if (update.docChanged) decorations = createDecorations(update.view);
    },
  };
}, {
  decorations: (plugin) => plugin.decorations,
});
