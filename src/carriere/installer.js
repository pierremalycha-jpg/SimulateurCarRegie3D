// @ts-check
import { on, emit } from '../state.js';
import { PROG, saveProgressSoon } from '../shared.js';
import { toast } from '../ui/common.js';
import { launch } from '../app/start.js';
import { restart } from '../app/nav.js';
import { commencee, recevoir, boite } from './index.js';
import { episodeById } from './mails.js';
import { societe } from './ui.js';

// ----------------------------------------------------------------------------------
// La Carrière dans le reste du simulateur (événement « carriere ») :
//   - une activité réussie (parcours d'Olivier terminé, montage de l'entrepôt rendu) peut réussir
//     la mission en cours : les mails qui arrivent sont reçus, notifiés (« courrier »), et la
//     mission réussie est annoncée (« fait » : badges, game/progression.js) ;
//   - « visite » : l'ordre de mission d'une visite du car (le bureau de l'entrepôt est déjà fermé)
//     lance le car régie, visite guidée réduite au tour du car et aux postes de la mission ;
//   - « retour » : depuis le car, retour au bureau de l'entrepôt (le simulateur se recharge).
// ----------------------------------------------------------------------------------
export function installCarriere() {
  const courrier = () => {
    if (!commencee(PROG)) return;
    const ids = recevoir(PROG); if (!ids.length) return;
    saveProgressSoon();
    const mails = boite(PROG, { societe: societe() }).filter((x) => ids.includes(x.id));
    const ici = document.body.classList.contains('entrepot-on');
    for (const m of mails) if (m.kind === 'retour') emit('carriere', { type: 'fait', id: m.ep.id });
    emit('carriere', { type: 'courrier', ids });
    // le dernier arrivé (une offre suit son retour) ; à l'entrepôt, après le message du montage rendu
    const m = mails[0]; if (!m) return;
    const dire = () => toast(`Nouveau mail de ${m.de.nom}${mails.length > 1 ? ` (et ${mails.length - 1} autre${mails.length > 2 ? 's' : ''})` : ''} : « ${m.objet} »${ici ? '' : ' Il t\'attend au bureau de l\'entrepôt.'}`, 'good', 7000);
    if (ici) setTimeout(dire, 3600); else dire();
  };
  on('tutor', (e) => { if (e && e.type === 'finish') courrier(); });
  on('entrepotRendu', () => courrier());
  on('carriere', (e) => {
    if (!e) return;
    if (e.type === 'visite') {
      const ep = episodeById(e.id); const a = ep ? ep.mission.action : null;
      if (!ep || !a || a.type !== 'visite') return;
      launch('standard', { visite: true, carriere: { id: ep.id, tour: a.tour, postes: [...a.postes] } });
    }
    if (e.type === 'retour') restart('carriere');
  });
}
