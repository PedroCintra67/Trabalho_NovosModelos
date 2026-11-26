# Turno na Esteira

Jogo de navegador sobre o trabalho repetitivo numa linha de corte de frango. Um turno fictício de oito horas dura 90 segundos. A esteira acelera a cada hora, as peças se acumulam e o trabalhador acumula desgaste. O jogo mostra a troca entre produção, saúde e pagamento.

## Jogar localmente

Na raiz do projeto, execute `python -m http.server 8000 --bind 127.0.0.1` e abra `http://127.0.0.1:8000/` no navegador. A interface usa módulos JavaScript e roda por HTTP, sem instalar pacotes.

## Como jogar

1. **E** (ou clique direito, ou o botão **Pegar peça**) tira da esteira a peça mais à direita ao alcance, destacada em amarelo, e a coloca na bancada.
2. Na bancada, a peça fica parada. Arraste com o mouse ou o dedo ao longo de cada linha tracejada, em qualquer sentido. Peito e coxa têm três cortes e asa tem dois. A faixa clara em volta da linha mostra a margem aceita, que encolhe com a fadiga.
3. **E** de novo devolve a peça à esteira. Completa, conta como processada. Incompleta, conta como mal processada e gera desconto.
4. Peças que chegam ao fim da esteira sem ser pegas são **perdidas** e também geram desconto.
5. Evite a **mão de apoio** e o **osso**, marcados em vermelho. Encostar neles, ou passar rápido demais muito perto, causa um acidente: a mão fica alguns instantes sem cortar e o tremor da faca aumenta até o fim do turno.
6. **P** inicia uma **pausa NR-36**. A fadiga cai, mas a esteira continua e peças podem passar. É preciso devolver a peça da bancada antes da pausa, e há um intervalo entre pausas.
7. **Escape** cancela o traço em andamento ou pausa o jogo.

Cortes limpos em sequência rendem um pequeno bônus. A cada hora, o supervisor compara a produção com a meta. O relatório final mostra produção, meta, perdas, fadiga máxima, pausas, acidentes e pagamento, com um comentário sobre o resultado. O melhor valor líquido fica salvo no navegador.

### Teclado e acessibilidade

As setas movem a mira (12 unidades; com Shift, 3) e Espaço inicia e encerra o traço. Ative **Orientação de teclado** e pressione **G** para ouvir a posição da etapa atual, da zona de risco e da margem aceita. **Som do jogo** liga ou desliga os efeitos sonoros. O jogo respeita a preferência do sistema por movimento reduzido.

## Estrutura

- `index.html` contém as telas e os controles.
- `styles/` contém a apresentação visual.
- `src/engine.mjs` contém as regras puras do turno: esteira, bancada, cortes, pausas e relatório. Os números de balanceamento ficam no objeto `TUNING`.
- `src/ui.mjs` conecta os controles, a cena, as partículas e o áudio ao motor.
- `tests/` cobre as regras do jogo com o executor de testes do Node.js.

Execute `node --test` para verificar o motor.

## Contexto

A NR-36, publicada pelo Ministério do Trabalho em 2013, regula a segurança e a saúde no trabalho em empresas de abate e processamento de carnes. Entre outras medidas, ela prevê pausas de recuperação psicofisiológica ao longo da jornada. Os valores de pagamento, metas e descontos do jogo são fictícios.

## GitHub Pages

1. Envie o código a um repositório privado cujo plano permita Pages. Para um repositório pessoal privado, é preciso GitHub Pro. GitHub Team e Enterprise também oferecem suporte em repositórios elegíveis.
2. No repositório, abra **Settings → Pages**.
3. Em **Build and deployment → Source**, selecione **Deploy from a branch**.
4. Selecione a branch que contém `index.html` na raiz, escolha **`/(root)`** e clique em **Save**.
5. Aguarde a publicação em **Actions**, volte a **Settings → Pages** e abra **Visit site**. Confira em uma janela anônima se a visibilidade corresponde à que você quer e jogue um turno completo.

O site pode ficar público mesmo com o repositório privado. [Documentação do GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
