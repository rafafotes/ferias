# Sistema Web de Planejamento de Férias para Famílias (MVP → Escalável)

## Suposições (sem perguntas)
Como você pediu objetividade e permitiu não perguntar, assumo:
1. Público principal no Brasil (idioma PT-BR), com destinos internacionais.
2. Planejamento de uma viagem por vez, por usuário.
3. Custos médios exibidos apenas na moeda local do destino (`currency_code`), sem conversão para BRL por padrão.

---

## 1) Arquitetura (MVP + escalável)

### 1.1 MVP (simples, robusto, baixa taxa de erro)

**Frontend (SPA)**
- React + TypeScript.
- Gerenciamento de estado com Zustand/Redux Toolkit.
- Formulários com React Hook Form + validação Zod.
- Roteamento com React Router.
- Renderização de impressão via CSS print + botão “Imprimir/Exportar PDF”.

**Backend API**
- Node.js (NestJS ou Fastify) + TypeScript.
- API REST (simples para MVP).
- Camadas:
  - `TripsController` / `TripsService`
  - `ItineraryController` / `ItineraryService`
  - `WeatherAdapter` (integração + fallback)
  - `SuggestionEngine` (regra de “dias parecidos”)
  - `CostService` (custos médios)

**Banco de dados**
- PostgreSQL.
- Tabelas normalizadas para `destinations`, `trips`, `trip_days`, `day_entries`, `cost_benchmarks`.

**Cache/Resiliência**
- Redis opcional no MVP (pode começar sem).
- Estratégia obrigatória: timeout curto + retry controlado + fallback (clima/sugestões/custos nunca quebram página).

**Observabilidade mínima**
- Logs estruturados (pino/winston).
- Correlation ID por request.
- Métricas básicas: latência de API, taxa de erro em integrações.

### 1.2 Evolução escalável (quando crescer)
- Quebrar em serviços:
  - `trip-service`
  - `context-service` (clima/sugestões)
  - `pricing-service` (custos médios)
- Fila (SQS/Rabbit/Kafka) para pré-processar roteiro final e snapshots de custo.
- Materialized views para relatórios e recomendações.
- Feature flags para experimentar heurísticas de sugestão.
- CDN para assets e edge caching de dados estáveis (destinos/custos médios).

### 1.3 Princípios anti-erro (essenciais)
- **Destino apenas por lista estruturada** (sem texto livre).
- Datas validadas com timezone do destino.
- Integradores externos **nunca** bloqueiam fluxo principal.
- Salvar rascunho automático por dia.
- Mensagens explícitas de fallback (não esconder erro com silêncio).

---

## 2) Modelo de dados

### 2.1 Entidades principais

#### `destinations` (catálogo fechado)
- `id` (UUID, PK)
- `name_pt` (string)
- `type` (`pais` | `regiao`)
- `country_code` (char(2), ISO-3166-1 alpha-2)
- `currency_code` (char(3), ISO-4217)
- `timezone` (string IANA)
- `center_lat` (numeric, opcional)
- `center_lng` (numeric, opcional)
- `active` (bool)
- índices: `country_code`, `type`, `active`

#### `trips`
- `id` (UUID, PK)
- `user_id` (UUID)
- `destination_id` (FK -> destinations.id)
- `arrival_date_local` (date)
- `departure_date_local` (date)
- `status` (`draft` | `finalized`)
- `timezone_snapshot` (string)
- `currency_snapshot` (char(3))
- `created_at`, `updated_at`

#### `trip_days`
- `id` (UUID, PK)
- `trip_id` (FK)
- `day_number` (int, D1..Dn)
- `date_local` (date)
- `weekday_ptbr` (string cacheado, ex: “segunda-feira”)
- `weather_status` (`ok` | `fallback`)
- `weather_summary` (string)
- `similar_day_reason` (string)

#### `day_entries`
- `id` (UUID, PK)
- `trip_day_id` (FK)
- `activities_text` (text)
- `time_optional` (time, nullable)
- `notes` (text)
- `tags` (text[])
- `estimated_cost_optional` (numeric(12,2), nullable)
- `updated_at`

#### `cost_benchmarks`
- `id` (UUID, PK)
- `destination_id` (FK)
- `valid_from` (date)
- `transport_avg_per_day` (numeric)
- `food_avg_per_day` (numeric)
- `currency_code` (char(3))
- `source` (string)
- `confidence` (0..1)

#### `trip_final_snapshots`
- `trip_id` (PK/FK)
- `itinerary_json` (jsonb)
- `costs_json` (jsonb)
- `generated_at`

### 2.2 Regras de integridade
- `departure_date_local > arrival_date_local`.
- `currency_snapshot == destinations.currency_code` no momento da criação.
- `timezone_snapshot == destinations.timezone` no momento da criação.
- `day_number` único por `trip_id`.

---

## 3) Telas/fluxos (wireframe textual)

### 3.1 Fluxo macro
1. **Criar viagem** (destino + chegada/saída)
2. **Planejamento dia a dia** (D1..Dn)
3. **Finalização**
4. **Página final printável**

### 3.2 Tela A — Criar Viagem
- Header: “Planejar férias em família”
- Campo 1: `Destino` (select pesquisável, **somente lista interna**)
  - Item exibe: `nome_pt` + `country_code` + `currency_code`
- Campo 2: `Data de chegada`
- Campo 3: `Data de saída`
- Preview: “Total de dias: N”
- CTA primário: “Criar roteiro”
- Validações inline:
  - destino obrigatório
  - saída > chegada

### 3.3 Tela B — Planejamento Dia a Dia
Layout 2 colunas:
- **Esquerda**: lista D1..Dn (status: pendente/preenchido)
- **Direita**: formulário do dia selecionado

Bloco superior do dia:
- `D3 — 14/07/2026 (terça-feira)` em PT-BR com timezone destino
- Clima:
  - sucesso: “22°C, parcialmente nublado”
  - fallback: “Previsão indisponível. Dica: planeje opção indoor + outdoor.”
- Sugestões:
  - “Pessoas com dia parecido costumam: parque pela manhã + museu à tarde.”
  - Explicação curta do critério (“clima + dia da semana + perfil de duração”).

Form do dia (RF6):
- `Atividades` (texto)
- `Horário (opcional)`
- `Observações`
- `Tags` (chips)
- `Custo estimado (opcional)`
- Autosave + botão “Salvar dia”

Ações:
- “Dia anterior” / “Próximo dia”
- “Finalizar roteiro” (habilita quando todos os dias têm ao menos atividades ou nota)

### 3.4 Tela C — Página Final (printável)
- Cabeçalho da viagem (destino, período, total dias)
- Seções por dia (D1..Dn): data, clima (ou fallback), atividades, notas, tags, custo estimado
- Box de **custos médios**:
  - Transporte médio/dia
  - Alimentação média/dia
  - Total médio da viagem (N dias)
  - Tudo em `currency_code` local
- Rodapé: data de geração + botão imprimir/exportar

### 3.5 Tela D — Compartilhar/Exportar (opcional)
- Gerar link somente leitura com token expirável **(opcional)**
- Exportar PDF **(opcional)**

---

## 4) Integrações + fallback (clima, sugestões, custos)

### 4.1 Clima
**Entrada**: destino (`center_lat/lng`), `date_local`, `timezone`.

**Fluxo**:
1. Buscar previsão em provedor (ex.: Open-Meteo/WeatherAPI).
2. Timeout curto (ex. 1200ms), 1 retry.
3. Se falhar/sem dado:
   - `weather_status=fallback`
   - mensagem padrão “indisponível”
   - recomendação genérica indoor/outdoor.

### 4.2 Sugestões (“o que pessoas fazem em dias parecidos”)
- Fonte MVP: base interna de templates por destino/tipo de dia.
- Não depende de LLM para funcionar.
- Se motor indisponível: renderizar sugestões padrão por destino e tipo (`pais`/`regiao`).

### 4.3 Custos médios
- Fonte: tabela `cost_benchmarks` atualizada por job (manual/API externa).
- Exibição somente em `currency_code` do destino.
- Fallback se sem benchmark:
  - mostrar “custo médio indisponível” + faixas genéricas com baixa confiança.

### 4.4 Contratos de API (resumo)
- `GET /destinations`
- `POST /trips`
- `GET /trips/:id/days`
- `PUT /trip-days/:dayId`
- `POST /trips/:id/finalize`
- `GET /trips/:id/final`

---

## 5) Regras/algoritmos (dias parecidos, custos médios)

### 5.1 Geração de D1..Dn
- `n = departure_date_local - arrival_date_local` (em dias).
- Para cada dia:
  - `date_local = arrival + (d-1)`
  - `weekday_ptbr = Intl.DateTimeFormat('pt-BR', { weekday:'long', timeZone: destination.timezone })`

### 5.2 Definição de “dia parecido” (explícita)
Score ponderado (0..1):
- Similaridade de clima (`weather_type`, temperatura faixa): 0.40
- Mesmo dia da semana (útil para lotação): 0.20
- Posição na viagem (início/meio/fim): 0.15
- Tipo de destino (`pais`/`regiao`, urbano/praia/natureza quando houver metadado): 0.15
- Duração total da viagem em faixa (curta/média/longa): 0.10

`similar_day` = maior score acima de limiar (ex.: 0.65). Se abaixo, usar sugestões base do destino.

### 5.3 Custos médios (transporte e alimentação)
Para viagem com `N` dias:
- `transport_total_avg = transport_avg_per_day * N`
- `food_total_avg = food_avg_per_day * N`
- `trip_total_avg = transport_total_avg + food_total_avg`

Se usuário preencher custos diários opcionais:
- Mostrar bloco separado “Seu custo estimado” (não substitui benchmark).

### 5.4 Formatação monetária/localização
- `Intl.NumberFormat(locale='pt-BR', { style:'currency', currency: currency_code })`
- Sem conversão cambial por padrão (opcional futuro).

---

## 6) Plano de testes (unit/integração/e2e)

### 6.1 Unitários
- **DateService**:
  - gera D1..Dn corretamente em timezone destino
  - calcula dia da semana PT-BR corretamente
- **SuggestionEngine**:
  - score de “dia parecido” com pesos corretos
  - fallback quando score < limiar
- **CostService**:
  - totais médios por N dias
  - fallback sem benchmark

### 6.2 Integração
- `POST /trips` valida destino de lista e datas.
- `GET /trips/:id/days` retorna clima + fallback consistente.
- `POST /trips/:id/finalize` gera snapshot final imutável.

### 6.3 E2E (Playwright/Cypress)
Cenários críticos:
1. Criar viagem válida e navegar D1..Dn.
2. Clima indisponível não quebra formulário.
3. Finalização gera página printável com custos em moeda local.
4. Reabrir viagem em `draft` mantém dados salvos.

### 6.4 Testes de resiliência
- Simular timeout em provedor de clima.
- Simular ausência de benchmark de custos.
- Garantir SLA de tela de planejamento mesmo com integrações falhando.

---

## 7) Checklist RF/RNF cobertos

### RF
- [x] **RF1** Seleção destino por lista + datas.
- [x] **RF2** Geração automática D1..Dn.
- [x] **RF3** Data + dia da semana PT-BR por timezone destino.
- [x] **RF4** Previsão do tempo + fallback explícito.
- [x] **RF5** Sugestões com critério explícito de “dia parecido”.
- [x] **RF6** Formulário por dia com atividades, horário opcional, observações, tags, custo opcional.
- [x] **RF7** Finalização com página final printável.
- [x] **RF8** Custos médios em moeda local do destino.
- [x] **RF9** Exportar/compartilhar marcado como opcional.

### RNF
- [x] **RNF1** SPA com autosave e UX sem reload por campo.
- [x] **RNF2** Integrações com timeout/retry/fallback para não derrubar app.
- [x] **RNF3** Privacidade por padrão (mínimo de dados e sem compartilhamento público por default).
- [x] **RNF4** Datas/weekday corretos com timezone do destino.

---

## Opcional (fora do escopo principal, explicitamente opcional)
- Perfil de família (idade das crianças, ritmo).
- Conversão cambial para BRL na página final.
- Recomendação inteligente com embeddings/ML.
