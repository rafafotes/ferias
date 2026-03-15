export const destinations = [
  {
    id: 'nl-amsterdam-region',
    nome_pt: 'Amsterdã e arredores',
    type: 'regiao',
    country_code: 'NL',
    currency_code: 'EUR',
    timezone: 'Europe/Amsterdam',
    center_lat: 52.3676,
    center_lng: 4.9041,
  },
  {
    id: 'pt-portugal',
    nome_pt: 'Portugal',
    type: 'pais',
    country_code: 'PT',
    currency_code: 'EUR',
    timezone: 'Europe/Lisbon',
    center_lat: 39.3999,
    center_lng: -8.2245,
  },
  {
    id: 'jp-tokyo-region',
    nome_pt: 'Tóquio e Kanto',
    type: 'regiao',
    country_code: 'JP',
    currency_code: 'JPY',
    timezone: 'Asia/Tokyo',
    center_lat: 35.6762,
    center_lng: 139.6503,
  },
  {
    id: 'us-orlando-region',
    nome_pt: 'Orlando',
    type: 'regiao',
    country_code: 'US',
    currency_code: 'USD',
    timezone: 'America/New_York',
    center_lat: 28.5383,
    center_lng: -81.3792,
  },
];

export const costBenchmarks = {
  'nl-amsterdam-region': { transport_avg_per_day: 24, food_avg_per_day: 45, confidence: 0.88 },
  'pt-portugal': { transport_avg_per_day: 18, food_avg_per_day: 32, confidence: 0.91 },
  'jp-tokyo-region': { transport_avg_per_day: 2200, food_avg_per_day: 4800, confidence: 0.84 },
  'us-orlando-region': { transport_avg_per_day: 38, food_avg_per_day: 52, confidence: 0.8 },
};

export const suggestionTemplates = {
  warm: [
    'Passeio ao ar livre pela manhã e pausa em café local à tarde.',
    'Parque ou praia cedo, atividade indoor no período mais quente.',
  ],
  mild: [
    'Centro histórico + museu com intervalos para refeições típicas.',
    'Parque urbano, mercado local e jantar em área movimentada.',
  ],
  cold: [
    'Museu/galeria pela manhã e atração coberta à tarde.',
    'Roteiro gastronômico + atividade infantil indoor.',
  ],
  fallback: [
    'Combine uma opção indoor e uma outdoor para reduzir risco climático.',
    'Escolha deslocamentos curtos e reserve pausas para as crianças.',
  ],
};
