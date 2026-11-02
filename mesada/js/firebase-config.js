/* =====================================================================
 *  FIREBASE — configuração pública do app Web (projeto mesada-lili)
 * =====================================================================
 *  Estes valores NÃO são segredos: identificam o projeto. A proteção dos
 *  dados vem das regras do Firestore (firestore.rules): cada família só
 *  lê/grava families/{uid} da própria conta.
 *
 *  enabled: true  -> a seção "Sincronizar" aparece na área do pai.
 *  Mesmo assim, o SDK do Firebase só é baixado e a rede só é usada depois
 *  que o pai cria/entra na conta da família. Sem isso, o app é 100% local.
 *
 *  Firestore: southamerica-east1 · Auth: e-mail/senha (plano gratuito).
 * ===================================================================== */
(function (g) {
  g.FIREBASE_CONFIG = {
    enabled: true,
    firebase: {
      apiKey: 'AIzaSyCpC5s6XMGgD4pC4R6oXRTYNzx26j3XGjw',
      authDomain: 'mesada-lili.firebaseapp.com',
      projectId: 'mesada-lili',
      storageBucket: 'mesada-lili.firebasestorage.app',
      messagingSenderId: '908407763294',
      appId: '1:908407763294:web:9b87481bb055e252119fcf'
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
