# Teleponto

Teleponto no browser que segue a voz e grava o vídeo na mesma página. Feito para gravar reels verticais a ler guiões em pt-PT, no Chrome para Android.

É um fork do [VoicePrompter](https://github.com/kosuvorov/VoicePrompter), de Konstantin Suvorov, sob a licença GPL-3 (ver `LICENSE`). As alterações deste fork estão no histórico do git; o plano está em [`docs/plano.md`](docs/plano.md).

## Correr no computador

```bash
npm install
npm run dev
```

Abre em `http://localhost:5173`. `npm test` corre os testes; `npm run build` gera a versão estática em `dist/`.

## Diferenças em relação ao original

- Sem estatísticas, gravação de sessões, anúncios, blog nem importação do Google Docs: a página não faz pedidos para fora.
- A app fica na raiz (`/`) e usa caminhos relativos, para funcionar numa subpasta do GitHub Pages.
- O deploy para o GitHub Pages só corre à mão.

## Receber melhorias do original

Como este fork apagou muitos ficheiros do original, um `merge` completo dá conflitos. É melhor ver os commits novos e trazer só os que interessam:

```bash
git fetch upstream && git log --oneline HEAD..upstream/main -- src
```

e depois `git cherry-pick <commit>`.
