# Sombra do Arcanum — V9 | Portões do Arcanum

Site medieval para criação, distribuição de pontos e armazenamento de fichas de RPG com senha.

## O que mudou

- O site abre na tela **Início**, com dois caminhos: **Nova Ficha** e **Biblioteca**.
- A biblioteca é pública: todos que acessam **a mesma implantação online** veem apenas **nome e retrato** de personagens; dados pessoais, atributos, recursos, inventário e habilidades exigem a senha da ficha.
- Ao criar e salvar, os dados são guardados, o editor é limpo e a ficha fica **selada**. Para consultar ou editar, é obrigatório voltar à biblioteca e digitar a senha.
- Ao salvar modificações, a ficha é novamente selada e o editor limpo. O botão **Sair da ficha** cancela o acesso atual (com aviso de alterações não salvas).
- Mantém o editor da V8, os retratos, o tema medieval, recursos vitais sem dados, calculadora 200 pts = 1d100 e botões de pontos.

## Regras do RPG

- **Sem classe:** 1.600 pontos; **com classe:** 1.800 pontos.
- Cada novo nível concede 250 pontos. XP para próximo nível pode ser alterado (inicia em 100).
- Vida 120, Estamina 50, Mana 50, Sanidade 100, Velocidade 50 e Peso 50 são bases **gratuitas**.
- Os quatro recursos vitais usam números e barras; **não geram dados**. Os atributos geram 1d100 por 200 pontos totais, incluindo a base gratuita.
- Os investimentos em atributos e recursos consomem o mesmo orçamento; distribuições inválidas não podem ser salvas.

## Executar online e compartilhar

Requisitos: Node.js 20+.

```bash
npm start
```

Acesse `http://localhost:3000`. Para amigos em outros aparelhos, publique o projeto em um servidor HTTPS com armazenamento persistente.

- O arquivo `server.mjs` serve o site e cria rotas de salvamento e consulta.
- `GET /api/sheets` retorna **somente** `{id, name, portrait}` de cada personagem. Retratos se tornam públicos na biblioteca.
- `POST /api/sheets` cria uma ficha; `POST /api/sheets/:id/unlock` exige senha para leitura; `POST /api/sheets/:id/save` exige senha para alterações.
- A senha é protegida por hash `scrypt` com salt exclusivo; não há recuperação automática se ela for esquecida. Limite básico de tentativas por IP.
- O caminho do banco de dados JSON pode ser definido pela variável de ambiente `DATABASE_FILE`. Configure um **disco persistente**. O `render.yaml` de exemplo usa plano Starter com disco, sujeito a cobrança pelo provedor.
- Inicie com uma base de dados vazia, sem as fichas de teste.

## Versão HTML local

Abra o arquivo `sombra_do_arcanum_v9.html` em um navegador que execute JavaScript. Essa versão permite armazenar fichas localmente no navegador, mas **não é uma biblioteca compartilhada** entre pessoas. A proteção local é limitada ao navegador e não substitui a segurança do servidor.

O visualizador de HTML dentro de aplicativos móveis pode bloquear JavaScript; publique o projeto para usar a versão completa e compartilhar as fichas.

**Atenção:** informações antigas salvas no mesmo navegador (V6–V8) continuam acessíveis na biblioteca local, quando a chave de armazenamento estiver disponível. Na V9, nome e retrato desses registros passam a ser mostrados publicamente ao usar o projeto online (inclusive fichas migradas para o servidor).
