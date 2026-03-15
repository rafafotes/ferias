# Planejador de Férias em Família

Implementação MVP em SPA estática (HTML/CSS/JS) com foco em simplicidade e baixa taxa de erro.

## Como rodar

```bash
python3 -m http.server 4173
```

Abra: `http://localhost:4173`.

## Testes

```bash
npm test
```

## Cobertura funcional desta implementação

- Seleção de destino por lista estruturada (sem texto livre).
- Entrada de chegada/saída e geração automática de D1..Dn.
- Dia da semana em PT-BR considerando timezone do destino.
- Previsão de tempo por dia via Open-Meteo com fallback resiliente.
- Sugestões por “dia parecido” com critério explícito.
- Edição dia a dia com atividades, horário opcional, observações, tags e custo opcional.
- Finalização com página printável e custos médios na moeda local do destino.
- Exportação opcional em JSON.
