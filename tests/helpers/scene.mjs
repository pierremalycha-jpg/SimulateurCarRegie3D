// Scène three.js vide (sans rendu) pour les tests qui posent des caméras : addCamera() ajoute
// les modèles 3D à la scène du monde (W.scene). À importer avant tout module qui en a besoin.
import './dom.mjs';
import * as THREE from 'three';
import { W } from '../../src/world.js';

if (!W.scene) W.scene = new THREE.Scene();
