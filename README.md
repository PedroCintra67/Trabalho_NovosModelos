# Turno na Esteira

Jogo de navegador sobre o trabalho repetitivo numa linha de corte de frango. O turno fictício de oito horas dura 90 segundos. A esteira mantém o ritmo enquanto a fadiga reduz o tempo para cortar e estreita a faixa de corte perfeito.

## Jogar localmente

Na raiz do projeto, execute `python -m http.server 8000 --bind 127.0.0.1` e abra `http://127.0.0.1:8000/` no navegador. Para testar em um subcaminho, execute o mesmo comando na pasta que contém o projeto e abra `http://127.0.0.1:8000/<nome-da-pasta>/`. O jogo usa módulos JavaScript e roda por HTTP sem instalar pacotes.

## Como jogar

1. Pressione **E** ou clique em **Pegar peça** para levar à bancada a peça ao alcance mais à direita. Clique direito na cena também funciona.
2. Acompanhe o anel que encolhe e o aviso de timing. Quando aparecer **CORTE AGORA**, pressione **Espaço**, clique em **Cortar** ou clique na cena. A primeira peça tem orientação na bancada, mais tempo para reagir e uma janela de acerto maior. Cada peça tem uma tentativa. Um corte perfeito vale 100 pontos e um bom vale 60. Um corte adiantado desperdiça a tentativa.
3. Pressione **E** novamente para devolver a peça. Se o tempo do corte acabar, ocorre um acidente. O curativo bloqueia temporariamente novas tentativas e há uma penalidade de timing até o fim do turno. O desconto do acidente aparece no painel e entra no cálculo do pagamento.
4. Com a bancada livre, pressione **P** para iniciar a pausa NR-36. A fadiga cai, mas a esteira continua. Pressione **Esc** para pausar ou retomar o jogo.

Peças que caem da esteira ou são devolvidas sem um corte válido geram descontos. Cortes perfeitos em sequência rendem bônus. Ao fim do turno, o relatório mostra a produção, os acidentes, as pausas e o pagamento simulado.

## Verificar

Execute `node --test` para rodar a suíte do motor.

## Contexto

A NR-36, publicada pelo Ministério do Trabalho em 2013, regula a segurança e a saúde no trabalho em empresas de abate e processamento de carnes. Entre outras medidas, ela prevê pausas de recuperação psicofisiológica ao longo da jornada. Os valores de pagamento, metas e descontos do jogo são fictícios.

## GitHub Pages

1. Envie o código a um repositório privado cujo plano permita Pages. Para um repositório pessoal privado, é preciso GitHub Pro. GitHub Team e Enterprise também oferecem suporte em repositórios elegíveis.
2. No repositório, abra **Settings → Pages**.
3. Em **Build and deployment → Source**, selecione **Deploy from a branch**.
4. Selecione a branch que contém `index.html` na raiz, escolha **`/(root)`** e clique em **Save**.
5. Aguarde a publicação em **Actions**, volte a **Settings → Pages** e abra **Visit site**. Confira em uma janela anônima se a visibilidade corresponde à que você quer e jogue um turno completo.

O site pode ficar público mesmo com o repositório privado. [Documentação do GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site)
