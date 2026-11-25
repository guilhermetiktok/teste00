# AniVerse · Desenvolvido por Guilherme Barreto (projeto em desenvolvimento)

## Executar
Os módulos ES exigem servidor HTTP (não abra com duplo clique): `python3 -m http.server 8000` ou a extensão Live Server do VS Code, e acesse http://localhost:8000.

## Publicar no GitHub Pages
Suba esta pasta para um repositório → Settings → Pages → Deploy from branch (main, / root).

## Firebase (projeto aniverse-7f72c)
1. **Authentication → Sign-in method:** ative **Google** e **E-mail/Senha**.
2. **Authentication → Settings → Authorized domains:** adicione `localhost` e `SEU-USUARIO.github.io`.
3. **Firestore Database:** crie o banco e cole o conteúdo de `firestore.rules` em Regras → Publicar.
4. No Google Cloud Console → Credenciais, restrinja a API key aos seus domínios (referenciadores HTTP).
A config web do Firebase é pública por design; a proteção real são as regras e os domínios autorizados. Nunca coloque chaves de service account no front-end.

## AdSense
Após aprovação, preencha `ADS.client` e `ADS.slot` em `js/firebase-config.js`. Enquanto vazio, aparece "Espaço publicitário".

## Testes rápidos
Navegue por todos os menus · busque um anime · filtros em Animes · ♥ como visitante (LocalStorage) · crie conta / Google / recuperar senha · edite o perfil · comente e avalie em um anime · publique e curta em Comunidade · veja Calendário e Assistir · alterne tema · teste no celular (menu ☰) · `#/xyz` mostra o 404.

## Estrutura
index.html · 404.html · css/style.css · js/app.js · js/firebase-config.js · firestore.rules
