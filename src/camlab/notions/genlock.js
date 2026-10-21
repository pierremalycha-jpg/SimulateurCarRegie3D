// @ts-check
// ----------------------------------------------------------------------------------
// Fiche « Genlock et référence ». Tri-level (SMPTE ST 274) : une impulsion à −300 mV puis +300 mV,
// 44 périodes d'horloge chacune ; à 74,25 MHz (1080i50), 0,593 µs par demi-impulsion, ligne de
// 35,56 µs. Black burst 625 lignes (ITU-R BT.1700) : ligne de 64 µs, top de synchro de 4,7 µs à
// −300 mV, salve de 10 périodes de sous-porteuse à 4,43 MHz, 5,6 µs après le front. Fiche Sony
// HXCU-FB80 : REFERENCE IN, BNC ×2 avec boucle ; HD : tri-level 0,6 V c-à-c (SMPTE 274M) ; SD :
// black burst 0,3 V (625 lignes). Sans CCU : prise PROMPTER/GENLOCK de la HXC-FB80, page M13
// GENLOCK du menu MAINTENANCE. Ligne de 75 Ω : terminée, l'onde garde son amplitude ; ouverte au
// bout, elle s'y réfléchit (coefficient +1) et l'amplitude double ; deux bouchons (37,5 Ω) la
// ramènent aux deux tiers. Coaxial : ≈ 5 ns par mètre. Quartz libre : 20 ppm (ordre de grandeur),
// soit 20 µs de dérive par seconde. La manipulation (labs/ch7.js, « genlock ») fait mesurer les
// deux références à l'oscilloscope, puis câbler et terminer la boucle de trois CCU.
// ----------------------------------------------------------------------------------

/** @type {import('./index.js').FicheCamera} */
export const GENLOCK = {
  t: 'Genlock et référence', aka: 'Generator lock ; référence tri-level ou black burst, entrée REFERENCE de la CCU', chap: 7, lot: 3, point: 'ccu',
  short: 'La CCU reçoit la référence de la régie, tri-level ou black burst, et cale la caméra dessus : son image commence en même temps que celle des autres sources, et le mélangeur coupe sans saut.',
  fig: 'genlock',
  lab: 'genlock',
  body: "**Pourquoi une référence.** Le mélangeur passe d'une caméra à l'autre entre deux images. Pour que la coupe ne se voie pas, toutes les sources doivent commencer leurs images, et chacune de leurs lignes, au même instant. Or chaque appareil a sa propre horloge, un quartz juste à quelques dizaines de millionièmes près : laissées libres, deux caméras glissent l'une par rapport à l'autre. La régie distribue donc un signal de rythme commun, la **référence**, et chaque appareil s'y **verrouille** : c'est le **genlock** (generator lock).\n\n**La CCU et la caméra.** La référence arrive sur l'entrée REFERENCE de la CCU. La CCU s'y verrouille et cale sur ce rythme la caméra, au bout de sa fibre. Un réglage de **phase**, dans la CCU, avance ou retarde la sortie (en lignes et en microsecondes) pour compenser les traitements et les câbles, et faire arriver l'image au mélangeur en même temps que les autres. Sans CCU, la caméra reçoit la référence sur sa prise PROMPTER/GENLOCK (page M13 GENLOCK du menu MAINTENANCE).\n\n**Deux signaux.**\n- Le **black burst** : un noir analogique de la télévision standard, 625 lignes de 64 µs, avec un top de synchronisation de 4,7 µs à −300 mV et une courte salve de sous-porteuse couleur (4,43 MHz). Hérité de la SD, il sert encore partout, même en HD.\n- Le **tri-level** : créé pour la HD (SMPTE ST 274). Une impulsion à −300 mV puis à +300 mV, 44 périodes d'horloge chacune, soit 0,59 µs en 1080i50. Le repère de temps est le passage par 0 V au milieu : il ne bouge pas si l'amplitude varie.\n\nLa fiche de la HXCU-FB80 accepte les deux sur la même entrée : un tri-level de 0,6 V crête à crête ou un black burst (top de 0,3 V).\n\n**Une entrée en boucle.** L'entrée REFERENCE a deux BNC : l'entrée et sa sortie de **boucle** (loop-through). On peut ainsi passer la référence d'une CCU à la suivante dans la baie. Mais le câble est une ligne de 75 Ω : le dernier appareil doit porter un **bouchon de 75 Ω** sur sa sortie de boucle. Sans bouchon, l'onde se réfléchit au bout du câble et s'ajoute à elle-même : l'amplitude double. Avec deux bouchons, elle tombe aux deux tiers.",
  vraie: "Sur la HXCU-FB80, l'entrée REFERENCE est à l'arrière : deux BNC, l'entrée et sa boucle. On contrôle le verrouillage sur la CCU, puis à la mesure : un oscilloscope sur la référence, et la mesure de phase (Timing) d'un instrument, qui place la sortie de la caméra par rapport à la référence.\n\n**Le bon geste.** La référence d'abord, avant de régler quoi que ce soit : chaque CCU reliée, chaque boucle terminée par **un** bouchon, au bout. Contrôler le signal à l'oscilloscope : 0,6 V crête à crête pour un tri-level, un top de 0,3 V pour un black burst. Puis la phase, réglée une fois pour toutes à l'installation.\n\n**L'erreur fréquente.** Débrancher une CCU au milieu de la boucle : toutes celles qui suivent perdent la référence. Oublier le bouchon : le signal double et se déforme, et certains appareils décrochent. Croire qu'une belle image au moniteur prouve le genlock : une CCU libre donne une image parfaite… jusqu'à la coupe.",
  plus: "- **La phase.** Être verrouillé ne suffit pas : chaque câble retarde le signal (≈ 5 ns par mètre de coaxial), chaque traitement aussi. Le mélangeur accepte une petite fenêtre, de l'ordre de ± ½ ligne (8,9 µs en 1080p50) ; au-delà, on règle la phase de la CCU.\n- **D'où vient la référence.** Du générateur de synchro de la régie (SPG), lui-même calé sur le GPS, puis de distributeurs (DA) : une sortie de DA par appareil ou par boucle. En production IP, la référence est l'heure PTP distribuée par le réseau (SMPTE ST 2059).\n- **Libre, combien de temps ?** Sans référence, la CCU tourne sur son horloge interne. Juste à 20 millionièmes près (un ordre de grandeur pour un quartz), elle glisse de 20 µs par seconde : elle sort de la fenêtre du mélangeur en moins d'une seconde.\n- **Les durées à mesurer.** Tri-level 1080i50 : 44 périodes d'une horloge à 74,25 MHz, soit 0,593 µs par demi-impulsion, sur une ligne de 35,56 µs. Black burst : ligne de 64 µs, top de 4,7 µs, salve de 10 périodes à 4,43 MHz.\n- **Pourquoi 75 Ω.** Le câble coaxial a une impédance de 75 Ω : terminé par 75 Ω, l'onde y est absorbée sans retour. Une boucle d'entrée, elle, ne charge presque pas la ligne : c'est le bouchon qui fait la terminaison.",
  car: "Dans le car, la référence vient du générateur de synchro du poste Synchro, calé sur le GPS, et part vers chaque CCU par les distributeurs. La baie CCU affiche RÉF. LOCK ou l'alarme RÉF. NON VERROUILLÉE pour chaque voie ; au poste Synchro, « Re-verrouiller toutes les CCU » remet en phase celles qui ont décroché.",
  quiz: [
    {
      q: 'Les CCU 1, 2 et 3 sont en boucle sur la référence, dans cet ordre. On débranche la CCU 2 pour la changer. Que se passe-t-il ?',
      a: [
        ['Rien : chaque CCU garde la référence en mémoire.', 'Une CCU sans référence tourne sur sa propre horloge : elle se met à glisser par rapport aux autres.'],
        ['La CCU 3, qui recevait la référence par la boucle de la CCU 2, la perd aussi.', 'Exact : en boucle, tout ce qui est après l\'appareil débranché perd la référence. On recâble la CCU 3 avant de retirer la 2.'],
        ['Seule la CCU 1 la perd.', 'La CCU 1 est en tête de boucle : elle reçoit la référence directement du distributeur.'],
      ],
      ok: 1,
    },
    {
      q: 'À l\'oscilloscope, le tri-level reçu par la dernière CCU de la boucle mesure 1,2 V crête à crête au lieu de 0,6 V. Pourquoi ?',
      a: [
        ['Le bouchon de 75 Ω manque au bout de la boucle : l\'onde se réfléchit et l\'amplitude double.', 'Exact : sans terminaison, l\'onde revient sur elle-même. Un bouchon sur la sortie de boucle de la dernière CCU, et le signal retombe à 0,6 V.'],
        ['Le distributeur est réglé trop fort.', 'Un distributeur sort 0,6 V sur une ligne terminée : c\'est la terminaison qui manque, pas un réglage.'],
        ['C\'est normal : un tri-level va de −300 mV à +300 mV.', 'De −300 mV à +300 mV, cela fait 0,6 V crête à crête, pas 1,2 V.'],
      ],
      ok: 0,
    },
    {
      q: 'Une CCU a perdu la référence. Que voit-on sur le moniteur de sa caméra ?',
      a: [
        ['Une image noire.', 'La CCU continue d\'envoyer l\'image de la caméra : c\'est le moment où ses images commencent qui n\'est plus le bon.'],
        ['Des couleurs fausses.', 'La référence ne porte que le rythme et la phase : elle ne touche pas aux couleurs.'],
        ['Une image normale, qui saute ou roule seulement à la coupe, au mélangeur.', 'Exact : le défaut ne se voit qu\'en passant d\'une source à l\'autre. C\'est pour cela qu\'on vérifie le verrouillage, pas l\'image.'],
      ],
      ok: 2,
    },
  ],
  see: ['ccu', 'sortie', 'connectique', 'formats', 'menu'],
  ref: 'SMPTE ST 274 (format 1080, synchro tri-level : ±300 mV, 44 périodes d\'horloge) ; ITU-R BT.1700 (black burst 625 lignes : top de 4,7 µs à −300 mV, salve à 4,43 MHz) ; fiche Sony HXCU-FB80 : REFERENCE IN, BNC ×2 avec boucle, tri-level 0,6 V c-à-c (SMPTE 274M) ou black burst 0,3 V ; mode d\'emploi HXC-FB80 : PROMPTER/GENLOCK, page M13 GENLOCK',
  competences: ['1.4', '1.2', '2.2'],
  cours: 'synchro-genlock',
};
