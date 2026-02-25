// vite.config.js
import { defineConfig } from 'vite'

export default defineConfig({
  // IMPORTANT : Remplacez 'NOM-DE-VOTRE-REPO' par le nom de votre dépôt GitHub
  // Exemple : si votre dépôt est https://github.com/votre-pseudo/mon-geste-3d
  // la base doit être '/mon-geste-3d/'
  base: '/mon-geste-3d/',
  build: {
    chunkSizeWarningLimit: 1600, // Augmente la limite d'avertissement de taille pour les fichiers 3D/IA
  }
})