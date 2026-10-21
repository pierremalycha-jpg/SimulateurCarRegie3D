// @ts-check
import { el } from '../util.js';
import { emit } from '../state.js';
// Réseau de contrôle Gigabit du car SDI : switchs, machines, adresses IP, masques, VLAN, QoS.
export function buildCtrlNet(body, arg, ctx) { void arg; void ctx;
  body.append(el('div', { class: 'hwpanel prose' }, el('h3', {}, 'Car en SDI'),
    el('p', {}, 'Ce car est câblé en SDI (coaxial, grille de commutation). Le réseau média ST 2110 n\'existe que dans le car IP : pour passer en IP, demandez-le au chef de car (touche J, « Passer le car en IP »).'),
    el('p', {}, 'Vous pouvez quand même consulter le chapitre « Réseau ST 2110 spine-leaf » du guide.'),
    el('button', { class: 'btn', onclick: () => emit('openGuide', 'reseau') }, 'Ouvrir le chapitre du guide')));
  return {};
}
