# LeadVoice — Plataforma de Gestão de Leads com Inteligência Artificial

## Visão Geral

O LeadVoice é uma plataforma inteligente de gestão de leads desenvolvida especialmente para a **Sunshine WL Brazilian LLC**, empresa de limpeza profissional atuando na Georgia, Florida, Texas, New York e Massachusetts.

A plataforma combina **ligações automatizadas com IA**, captura automática de leads, gestão de pipeline CRM e notificações multicanal — tudo em um painel unificado.

---

## Funcionalidades Principais

### 1. SunnyBee — Assistente de Ligações com IA

- Ligações automáticas de saída com voz natural de IA
- Conversa profissional em inglês com os leads
- Extrai dados estruturados: nome, telefone, tipo de imóvel, serviço desejado, disponibilidade
- Gera resumos inteligentes das ligações usando OpenAI GPT-4o-mini
- Número dedicado: **+1 (470) 888-4921**
- Voz: Feminina natural (OpenAI "shimmer")

### 2. Dashboard

- KPIs em tempo real: Total de Leads, Total de Ligações, Campanhas Ativas, Taxa de Conversão, Duração Média, Ligações Hoje
- Tela de boas-vindas personalizada
- Indicador de status da SunnyBee AI (Online e Pronta)
- Acesso rápido às Ligações Recentes e Campanhas Ativas

### 3. Gestão de Leads

- **Cadastro manual**: Adicione leads um a um via formulário
- **Importação em massa**: Upload de arquivos CSV com centenas de leads
- **Perfis detalhados**: Informações de contato, detalhes do imóvel, solicitações de serviço
- **Pipeline CRM de 11 estágios**: De "Lead Novo" até "Fechado/Ganho"
- **Rastreamento de status**: Novo → Contatado → Qualificado → Convertido → Perdido

### 4. Campanhas

- Crie campanhas de prospecção segmentadas
- Atribua leads específicos a cada campanha
- Configure janelas de horário para ligações e fusos horários
- Controle de Iniciar/Pausar
- Status por lead: Pendente → Em Progresso → Concluído

### 5. Histórico de Ligações

- Registro completo de todas as ligações (entrada e saída)
- Resumos gerados por IA para cada ligação
- Gravações e transcrições completas
- Classificação de resultado: Interessado, Não Interessado, Retornar, Correio de Voz, Agendado, Depósito Solicitado

### 6. Mensagens SMS

- Envie SMS para leads diretamente pela plataforma
- Envie para qualquer número de telefone (não apenas leads cadastrados)
- **18 templates prontos**: Primeiro contato, follow-up, orçamento, lembrete de pagamento, avaliação pós-serviço
- Rastreamento de status de entrega (Enviado, Entregue, Falhou)
- Powered by Twilio

### 7. Notificações Automáticas (Workflows N8N)

| Gatilho | Ação |
|---------|------|
| Ligação concluída | Auto-registro no Google Sheets |
| Novo lead interessado | Notificação por email para o proprietário |
| Novo lead interessado | Alerta SMS para o celular do proprietário |
| Diário (20h) | Relatório resumido de todos os leads do dia |

### 8. Calendário

- Visualize agendamentos de limpeza
- Cores por tipo de serviço (Limpeza Profunda, Padrão, Recorrente, Mudança)
- Visualizações: Mês, Semana, Dia e Lista

### 9. Análises (Analytics)

- Tendência de volume de ligações (gráfico de 30 dias)
- Visualização de funil de conversão
- Distribuição de resultados das ligações (gráfico de pizza)
- Leads por fonte e por status

---

## Como Funciona

```
1. Lead entra no sistema (manual, CSV ou futura integração Google Ads)
        ↓
2. Lead é atribuído a uma Campanha
        ↓
3. SunnyBee AI liga automaticamente para o lead
        ↓
4. IA extrai dados da conversa (nome, imóvel, tipo de serviço)
        ↓
5. Resumo da ligação é gerado e o perfil do lead é atualizado
        ↓
6. Notificações disparam: Google Sheets + Email + SMS para o proprietário
        ↓
7. Proprietário revisa o dashboard e toma ação (orçamento, agendar, follow-up)
```

---

## Stack Tecnológica

| Camada | Tecnologia |
|--------|-----------|
| Frontend | Next.js 15, React 19, Tailwind CSS |
| Backend | Fastify 5, TypeScript |
| IA de Voz | VAPI (IA conversacional) |
| Extração de Dados IA | OpenAI GPT-4o-mini |
| SMS e Telefone | Twilio |
| Automação | N8N (self-hosted) |
| Banco de Dados | PostgreSQL + Prisma ORM |
| Cache e Filas | Redis + BullMQ |
| Infraestrutura | Docker, EasyPanel, Hostinger VPS |

---

## Segurança

- Autenticação baseada em JWT
- Variáveis de ambiente validadas na inicialização (Zod)
- Proteção CORS configurada por domínio
- Conexões criptografadas com banco de dados
- Controle de acesso baseado em roles

---

## Acesso

| Recurso | URL |
|---------|-----|
| Dashboard | https://leadvoice.sunshinebrazilian.com |
| API | https://api.sunshinebrazilian.com |
| Workflows | https://workflow.sunshinebrazilian.com |

---

## Roadmap Futuro

- Captura de leads via Google Ads (webhook automatizado)
- Integração com Google Calendar para agendamentos
- Múltiplos perfis de usuário (Admin, Gerente, Agente)
- Integração com WhatsApp
- Portal do cliente para autoagendamento

---

**Powered by Optzen**
