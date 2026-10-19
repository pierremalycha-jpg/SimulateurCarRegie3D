// @ts-check
import { el } from '../util.js';

// ----------------------------------------------------------------------------------
// Texte enrichi des explications (chef de car, fiches des termes) : paragraphes séparés par
// une ligne vide, listes « - » et « 1. », **gras** et `code`.
// ----------------------------------------------------------------------------------
export function rich(text, cls = 'chef-say') {
  const box = el('div', { class: cls });
  for (const para of String(text).split(/\n\n+/)) {
    const lines = para.split('\n');
    let ul = null, ol = null; let p = null;
    for (const line of lines) {
      const li = /^- (.*)$/.exec(line), oi = /^\d+\. (.*)$/.exec(line);
      if (li) { if (!ul) { ul = el('ul'); box.append(ul); } ul.append(inline(li[1])); continue; }
      if (oi) { if (!ol) { ol = el('ol'); box.append(ol); } ol.append(inline(oi[1])); continue; }
      ul = ol = null;
      if (!p) { p = el('p'); box.append(p); } else p.append(el('br'));
      p.append(...inline(line).childNodes);
    }
  }
  return box;
}
export function inline(s) {
  const li = el('li');
  for (const part of String(s).split(/(`[^`]+`|\*\*[^*]+\*\*)/)) {
    if (!part) continue;
    if (part.startsWith('`')) li.append(el('code', {}, part.slice(1, -1)));
    else if (part.startsWith('**')) li.append(el('b', {}, part.slice(2, -2)));
    else li.append(document.createTextNode(part));
  }
  return li;
}
