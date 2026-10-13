# Pró3 Documentos

Sistema para receber e conferir os documentos de faturamento de veículos de mídia (PIs de ALESC, Prefeitura de Xanxerê e Prefeitura de Chapecó), fechar a medição de cada PI e liberar o pagamento ao veículo.

## Como o fluxo funciona

1. O veículo abre `/veiculo`, escolhe cliente e campanha e anexa os documentos exigidos para aquela campanha. No fim recebe um comprovante de protocolo em PDF.
2. Operadores conferem os documentos em `/app/documentos` e `/app/aprovacoes`, aprovam ou devolvem ao veículo com o motivo (o veículo recebe e-mail).
3. Cada PI aprovado ganha uma **medição** em `/app/faturamento`: valor bruto, comissão da agência e líquido.
4. O operador envia a medição ao financeiro. O financeiro **libera** o pagamento (com previsão) e depois registra o **pagamento**.
5. `/app/gerencial` mostra valores medidos, comissão, pagamentos previstos e pontos de atenção.

### Papéis

| Papel | Pode |
| --- | --- |
| Operador | Aprovar documentos, criar campanhas e regras de documentos, medir PIs e enviar medições ao financeiro |
| Financeiro | Liberar pagamentos, devolver medições para ajuste e registrar pagamentos |
| Administrador | Tudo, mais clientes, usuários, papéis e catálogo de documentos |

Quem tem conta mas nenhum papel não vê dados.

## Stack

Vite, React 18, TypeScript, Tailwind e shadcn/ui, TanStack Query, Recharts e Supabase (Postgres, Auth, Storage e Edge Functions). Deploy no Vercel.

## Rodando localmente

```bash
npm install
cp .env.example .env   # preencha com a URL e a chave publicável do projeto Supabase
npm run dev
```

## Banco de dados

O schema vive em `supabase/migrations`. Todas as tabelas têm RLS ligado; as regras por papel usam funções no schema `private`, que não é exposto pela API.

- `submissions`, `documents`, `submission_events`: envios, arquivos e histórico.
- `clientes`, `campanhas`, `tipos_documento`, `campanha_documentos`: cadastros e a estrutura de documentos de cada campanha.
- `medicoes`, `medicao_eventos`: medição por PI e a máquina de estados do pagamento (`criar_medicao` e `mudar_status_medicao` aplicam o papel exigido em cada passo).
- `user_roles`, `profiles`: acesso.

## Edge Functions

| Função | Para quê | Segredos |
| --- | --- | --- |
| `analisar-documentacao` | Pré-análise dos documentos pela API da Anthropic. Dispara sozinha quando o envio fica completo. | `ANTHROPIC_API_KEY` |
| `send-rejection-email` | E-mail ao veículo quando o envio volta com pendência. | `RESEND_API_KEY`, opcional `EMAIL_FROM` |
| `gerir-usuarios` | Criar contas, desativar e redefinir senha (só admin). | nenhum além dos padrões |

O segredo que autentica o gatilho do banco na função de análise fica no Vault do Postgres (`analise_webhook_secret`).

## Primeiro acesso

O e-mail listado em `private.admins_iniciais` recebe o papel de administrador ao confirmar a conta. Depois disso, novos usuários são criados em `/app/cadastros/usuarios`.
