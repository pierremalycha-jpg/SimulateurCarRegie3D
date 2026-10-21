// @ts-check
import { el } from '../util.js';
// Baie de mesure : instrument type Tektronix PRISM sur le signal SDI (diagramme de l'œil, gigue…).
export function buildPrismStation(body, arg, ctx) { void arg; void ctx;
  body.append(el('p', { class: 'note' }, 'Instrument de mesure en préparation.'));
  return {};
}
