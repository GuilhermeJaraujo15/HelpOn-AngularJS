# Nomes dos autores no chat

Execute `migrations/202610060001_comment_author_names.sql` no SQL Editor do
projeto Supabase configurado em `app.js`, com uma conta administrativa.
Depois publique o `app.js` atualizado e recarregue a aplicação.

A função retorna somente `author_id` e `full_name` dos autores de comentários
do chamado solicitado. Passageiros só podem consultar autores de comentários
públicos dos próprios chamados; atendentes e administradores podem consultar
os chamados da operação. A função exige autenticação, fixa o `search_path` e
verifica a autorização explicitamente. Não amplia a leitura da tabela
`profiles`, que também contém CPF, telefone e outros dados pessoais.

O nome vem do cadastro atual, sem substituir todos os autores por um nome fixo.
Isso atende contas de passageiros existentes e futuras e comentários antigos.
Se a função ainda não estiver instalada, as mensagens continuam acessíveis,
mas autores bloqueados pela leitura de `profiles` aparecem como
“Nome indisponível” até a aplicação da migração.

Validação após aplicar:

1. Entre como passageiro e abra um chamado com mensagens do administrador:
   confira “Administrador Sistema” e as iniciais “AS”.
2. Confira que mensagens do próprio passageiro e de outros atendentes mantêm
   os respectivos nomes.
3. Com a sessão de outro passageiro, chame a RPC para o primeiro chamado:
   o resultado deve ser vazio. Uma chamada sem autenticação deve ser negada.
4. Confira que autores exclusivos de comentários internos não são retornados
   ao passageiro e que a consulta não retorna dados pessoais do perfil.

Referência: https://supabase.com/docs/guides/database/functions
