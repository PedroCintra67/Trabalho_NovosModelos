# Turno na Esteira

Jogo de precisão para navegador sobre o trabalho repetitivo em uma linha de corte de frango. Um turno fictício de oito horas dura 75 segundos. Conforme a esteira acelera, o placar da fábrica cresce e o trabalhador acumula desgaste.

## Jogar localmente

Na raiz do projeto, execute `python -m http.server 8000 --bind 127.0.0.1` e abra `http://127.0.0.1:8000/` em um navegador de computador. A interface usa módulos JavaScript e roda por HTTP, sem instalação de pacotes.

Com mouse ou trackpad, pressione e arraste rapidamente ao longo da linha tracejada da peça enquanto ela passa pela estação. Você pode traçar nos dois sentidos. Evite as áreas sinalizadas da mão de apoio e do osso. Após um acidente, o turno segue com perda de precisão. O relatório final compara produção, meta, fadiga, erros, acidentes e pagamento. Os valores representam uma economia fictícia do jogo.

No teclado, as setas movem a mira. Espaço inicia ou encerra o traço e Escape cancela. Ative **Orientação de teclado** e pressione G para consultar a peça e a posição da mira. Use **Som do jogo** para ligar ou desligar os efeitos sonoros.

## Estrutura

- `index.html` contém as telas e os controles.
- `styles/` contém a apresentação visual.
- `src/engine.mjs` contém as regras do turno, do corte e do placar.
- `src/ui.mjs` conecta os controles, a cena e o áudio ao motor.
- `tests/` cobre as regras do jogo com o executor de testes do Node.js.

Execute `node --test` para verificar o motor.

## GitHub Pages

1. Envie o código a um repositório privado cujo plano permita Pages. Para um repositório pessoal privado, é preciso GitHub Pro. GitHub Team e Enterprise também oferecem suporte em repositórios elegíveis.
2. No repositório, abra **Settings → Pages**.
3. Em **Build and deployment → Source**, selecione **Deploy from a branch**.
4. Selecione a branch que contém `index.html` na raiz, escolha **`/(root)`** e clique em **Save**.
5. Aguarde a publicação em **Actions**, volte a **Settings → Pages** e abra **Visit site**. Confira em uma janela anônima se a visibilidade corresponde à que você quer e jogue um turno completo.

O site pode ficar público mesmo com o repositório privado. [Documentação do GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
