# Teleponto — plano

Teleponto no browser que segue a voz, para gravar reels (20–40 s, 9:16) da EF Techsolutions a ler guiões em pt-PT.
**Telemóvel alvo: Android (Chrome).** iPhone não interessa.

Ponto de partida: fork do [VoicePrompter](https://github.com/kosuvorov/VoicePrompter) (licença GPL-3, código aberto).
Em vez de começar do zero, aproveita-se o que já funciona e melhora-se o que é fraco.

## O que o VoicePrompter já traz (lido no código, 12 out 2026)

- Segue a voz com o reconhecimento do browser (Web Speech API); tem pt-PT.
- Grava vídeo na própria página (câmara frontal, MP4/WebM, guarda o ficheiro).
- Modo espelho, temas, tamanho de letra, histórico de guiões, PWA (instala-se e funciona offline).
- Modo «som»: rola a uma velocidade fixa enquanto há som e pára quando te calas.

## O problema principal no Android

O próprio VoicePrompter avisa: **no Android, o reconhecimento de voz e o microfone da gravação não funcionam ao mesmo tempo.**
Ou seja, tal como está, no teu telemóvel ou o texto segue a voz, ou gravas o vídeo — não as duas coisas.
A fase 3 resolve isto (ver abaixo). Confirmar no teu telemóvel logo na fase 0.

## Fases

Cada passo traz a sua verificação.

### Fase 0 — Base (≈ 30 min)
1. Trazer o código com histórico (remote `upstream`, para receber melhorias do autor) → verificar: `npm run dev` abre a app no preview.
2. Tirar o que não serve: os dois rastreadores de estatísticas (script externo e Umami), anúncios das apps pagas, blog e páginas de marketing → verificar: nenhum pedido de rede para fora quando a app corre.
3. Teste no teu Android: modo vídeo + voz → confirmar o conflito do microfone.

### Fase 1 — Seguimento melhor em pt-PT (≈ 1 h 30)
Hoje o algoritmo compara as últimas 5 palavras ditas com as próximas do texto, palavra exatamente igual, e avança.
Melhorias:
1. **Normalizar** antes de comparar: minúsculas, sem acentos, sem pontuação (o reconhecedor às vezes erra um acento).
2. **Números**: «3» no guião = «três» dito; «22h» = «vinte e duas horas».
3. **Tolerância a erros**: aceitar palavras quase iguais (distância de Levenshtein — quantas letras é preciso mudar).
4. **Não saltar por palavras pequenas**: «de», «a», «o», «que» só contam se estiverem logo a seguir; para saltar mais longe é preciso acertar 2 palavras seguidas.
5. **Voltar atrás** quando repetes uma frase (procurar também uns passos para trás).
6. Comandos de voz em português (ex.: «volta ao início»), em vez de «go back».
→ verificar: testes automáticos com os 3 guiões e transcrições com erros simulados (palavras trocadas, repetições, números).

### Fase 2 — Conforto e gravação de reels (≈ 1 h)
1. Ecrã não apaga enquanto lês (Wake Lock) e botão de ecrã inteiro.
2. Interface em português; por defeito: pt-PT, letra grande, linha de leitura no topo (junto à câmara frontal).
3. Gravação vertical 9:16 (1080×1920) e contagem decrescente 3-2-1 antes de gravar.
4. Comando Bluetooth / clicker de apresentações e teclado (avançar, recuar, pausar).
→ verificar no preview (formato móvel) e no teu telemóvel.

### Fase 3 — Gravar e seguir a voz ao mesmo tempo no Android
Duas soluções, pela ordem:
- **A. Modo som com o microfone da gravação** (≈ 30 min). O texto rola enquanto falas e pára quando paras, usando o mesmo microfone do vídeo. Não segue palavra a palavra, mas funciona já. Garante que consegues gravar reels.
- **B. Reconhecimento local (Vosk) a partir do microfone da gravação** (spike, ≈ 2 h, descartável se falhar). Corre no telemóvel, sem internet, e segue palavra a palavra. Para compensar a precisão fraca do modelo português pequeno (31 MB, treinado com português do Brasil), limita-se o vocabulário às palavras do guião.
→ verificar: gravar um reel de 30 s no teu Android com o texto a seguir.

### Fase 4 — Pôr no teu telemóvel
A câmara e o microfone só funcionam em páginas seguras (HTTPS). Duas maneiras:
- **GitHub Pages** (grátis, endereço fixo, instala-se como app). Precisa do teu «sim» para publicar. O código fica público (a licença GPL obriga a isso de qualquer forma).
- **Cabo USB ao Mac** (Chrome → `chrome://inspect` → reencaminhar a porta): o telemóvel abre a versão local. Não publica nada, mas só funciona ligado ao Mac.
Depois: Chrome → «Adicionar ao ecrã principal».

### Fica para depois
- Comando a partir de outro telemóvel: precisaria de um servidor para ligar os dois aparelhos. O clicker Bluetooth (fase 2) resolve o mesmo sem servidor.
- Hardware (vidro de teleponto, microfone de lapela, luz): recomendações com preços verificados quando a ferramenta estiver a funcionar.

## Ferramentas, em linguagem simples

| Ferramenta | O que faz | Escolha |
|---|---|---|
| **Web Speech API** | O reconhecimento de voz que já vem no Chrome. No Android o áudio vai para os servidores da Google. Rápido e bom em pt-PT. | Usar para ler **sem gravar**. |
| **Vosk (WASM)** | Reconhecimento de voz que corre dentro da página, no telemóvel, sem internet. Modelo português de 31 MB, menos preciso. | Spike na fase 3B, para **gravar e seguir ao mesmo tempo**. |
| **Whisper no browser** | O reconhecimento da OpenAI a correr na página. Muito preciso, mas lento num telemóvel para seguir em tempo real. | Não usar. |
| **getUserMedia** | Dá à página acesso à câmara e ao microfone. | Já usado. |
| **MediaRecorder** | Grava o que a câmara vê para um ficheiro de vídeo. | Já usado; passar a 9:16. |
| **Wake Lock** | Impede o ecrã de apagar. | Fase 2. |
| **Fullscreen** | Esconde as barras do browser. | Fase 2. |
| **PWA** | Instala a página como app no ecrã principal; funciona sem internet. | Já existe. |
| **Levenshtein** | Mede quão diferentes são duas palavras (quantas letras mudar). Serve para aceitar «teleponto» quando o reconhecedor ouviu «telepontos». | Fase 1. |
| **Clicker Bluetooth** | O comando de apresentações liga-se ao telemóvel como um teclado. | Fase 2. |

## Decisões

- Decisão: fork do VoicePrompter em vez de construir de raiz — já tem gravação, espelho e PWA, e poupa 2–3 h — se estiver errado, o código dele é TypeScript simples e pode-se reescrever por partes.
- Decisão: manter o histórico e o remote `upstream` — permite trazer correções do autor — custo baixo; se atrapalhar, corta-se.
- Decisão: Android primeiro, sem testes em iPhone — o Elder só usa Android — se um dia houver iPhone, a base do VoicePrompter já o suporta.
- Decisão: fase 3A antes da 3B — garante gravar reels já, com pouco risco; o Vosk pode não ser preciso o suficiente — se a 3B falhar, perdem-se ≈ 2 h.

## Estado (13 out 2026)

| Fase | Estado | Commit |
|---|---|---|
| 0 — Base | Feita. Saíram também um gravador de sessões (gravava 30 % das visitas) e um erro de arranque do original. | `b8ed980` |
| 1 — Seguimento pt-PT | Feita. 18 testes com os 3 guiões (`npm test`). | `4611987` |
| 2 — Conforto e gravação | Feita, mais definições guardadas e abrir com o último guião. | `73bc826` |
| 3A — Modo som a gravar no Android | Feita (mesmo commit). Testada no browser com câmara e microfone simulados. | `73bc826` |
| 3B — Vosk | Por fazer (spike). | — |
| 4 — No telemóvel | Publicado com o «sim» do Elder: https://enfernandes.github.io/teleponto/ (repo ENFernandes/teleponto). Deploy só à mão: Actions → Deploy to GitHub Pages → Run workflow, ou `gh workflow run deploy.yml`. | `8f82962` |

Por confirmar no telemóvel do Elder: o conflito do microfone no Android, o formato vertical do vídeo gravado e a precisão do reconhecimento com a voz dele.
