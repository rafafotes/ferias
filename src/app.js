import { destinations, costBenchmarks, suggestionTemplates } from './data.js';
import {
  addDays,
  calculateAverageCosts,
  calculateTripDays,
  climateBucket,
  getWeekdayPtBr,
  similarDayScore,
} from './planner-core.js';

const state = {
  trip: null,
  days: [],
  selectedDayIndex: 0,
};

const tripCreateEl = document.querySelector('#trip-create');
const plannerEl = document.querySelector('#planner');
const finalEl = document.querySelector('#final-page');

renderCreateForm();

function renderCreateForm() {
  tripCreateEl.innerHTML = `
    <h2>1) Criar viagem</h2>
    <div class="form-row cols-3">
      <div>
        <label for="destination">Destino</label>
        <select id="destination">
          <option value="">Selecione...</option>
          ${destinations
            .map(
              (d) =>
                `<option value="${d.id}">${d.nome_pt} (${d.country_code}) • ${d.currency_code}</option>`
            )
            .join('')}
        </select>
      </div>
      <div>
        <label for="arrival">Data de chegada</label>
        <input id="arrival" type="date" />
      </div>
      <div>
        <label for="departure">Data de saída</label>
        <input id="departure" type="date" />
      </div>
    </div>
    <p id="trip-preview" class="muted">Selecione destino e datas.</p>
    <button id="create-trip">Criar roteiro</button>
  `;

  const destinationInput = tripCreateEl.querySelector('#destination');
  const arrivalInput = tripCreateEl.querySelector('#arrival');
  const departureInput = tripCreateEl.querySelector('#departure');
  const preview = tripCreateEl.querySelector('#trip-preview');

  [destinationInput, arrivalInput, departureInput].forEach((el) =>
    el.addEventListener('change', () => {
      const days = calculateTripDays(arrivalInput.value, departureInput.value);
      preview.textContent = days > 0 ? `Total de dias: ${days}` : 'Informe datas válidas (saída > chegada).';
    })
  );

  tripCreateEl.querySelector('#create-trip').addEventListener('click', async () => {
    const destination = destinations.find((d) => d.id === destinationInput.value);
    const arrival = arrivalInput.value;
    const departure = departureInput.value;
    const totalDays = calculateTripDays(arrival, departure);

    if (!destination || !arrival || !departure || totalDays < 1) {
      alert('Preencha destino e datas válidas (saída maior que chegada).');
      return;
    }

    state.trip = {
      id: crypto.randomUUID(),
      destination,
      arrival,
      departure,
      totalDays,
      status: 'draft',
    };

    state.days = Array.from({ length: totalDays }, (_, index) => ({
      dayNumber: index + 1,
      date: addDays(arrival, index),
      weekday: getWeekdayPtBr(addDays(arrival, index), destination.timezone),
      weather: { status: 'loading', summary: 'Carregando...' },
      similarReason: 'Critério: clima + dia da semana + posição da viagem + tipo de destino + duração.',
      suggestions: ['Carregando sugestões...'],
      form: { activities: '', time: '', notes: '', tags: '', estimatedCost: '' },
    }));

    for (const day of state.days) {
      hydrateWeatherAndSuggestions(day, state.trip).catch(() => undefined);
    }

    plannerEl.classList.remove('hidden');
    finalEl.classList.add('hidden');
    state.selectedDayIndex = 0;
    renderPlanner();
  });
}

async function hydrateWeatherAndSuggestions(day, trip) {
  const weather = await fetchWeather(trip.destination, day.date);
  day.weather = weather;
  const bucket = climateBucket(weather.tempC);
  day.suggestions = buildSuggestions({
    bucket,
    weekday: day.weekday,
    dayNumber: day.dayNumber,
    totalDays: trip.totalDays,
    destinationType: trip.destination.type,
  });
  renderPlanner();
}

async function fetchWeather(destination, date) {
  if (destination.center_lat == null || destination.center_lng == null) {
    return {
      status: 'fallback',
      summary: 'Previsão indisponível. Dica: planeje opção indoor + outdoor.',
      tempC: null,
    };
  }

  const url = `https://api.open-meteo.com/v1/forecast?latitude=${destination.center_lat}&longitude=${destination.center_lng}&daily=temperature_2m_max,weathercode&timezone=${encodeURIComponent(
    destination.timezone
  )}&start_date=${date}&end_date=${date}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 1200);

  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error('weather api error');
    const data = await response.json();
    const temp = data?.daily?.temperature_2m_max?.[0];
    if (temp == null) throw new Error('missing weather data');
    return { status: 'ok', summary: `Máx ${Math.round(temp)}°C`, tempC: Number(temp) };
  } catch {
    return {
      status: 'fallback',
      summary: 'Previsão indisponível. Dica: planeje opção indoor + outdoor.',
      tempC: null,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function buildSuggestions({ bucket, weekday, dayNumber, totalDays, destinationType }) {
  const position = dayNumber <= 2 ? 1 : dayNumber >= totalDays - 1 ? 0.7 : 0.9;
  const score = similarDayScore({
    climateMatch: bucket === 'fallback' ? 0.5 : 1,
    sameWeekday: ['sábado', 'domingo'].includes(weekday) ? 1 : 0.8,
    positionMatch: position,
    destinationTypeMatch: destinationType === 'regiao' ? 0.9 : 0.75,
    tripLengthMatch: totalDays <= 4 ? 0.85 : 1,
  });

  if (score < 0.65 || bucket === 'fallback') return suggestionTemplates.fallback;
  return suggestionTemplates[bucket] ?? suggestionTemplates.mild;
}

function renderPlanner() {
  if (!state.trip) return;

  const selected = state.days[state.selectedDayIndex];
  const allHaveContent = state.days.every((d) => d.form.activities.trim() || d.form.notes.trim());

  plannerEl.innerHTML = `
    <h2>2) Planejamento dia a dia</h2>
    <div class="split">
      <aside class="day-list">
        ${state.days
          .map(
            (d, index) => `<button class="${index === state.selectedDayIndex ? 'active' : 'secondary'}" data-day="${index}">
              D${d.dayNumber} — ${d.date} ${d.form.activities || d.form.notes ? '✅' : '•'}
            </button>`
          )
          .join('')}
      </aside>

      <section>
        <div class="meta">
          <strong>D${selected.dayNumber} — ${selected.date} (${selected.weekday})</strong>
          <p>🌦️ ${selected.weather.summary}</p>
          <p>💡 ${selected.suggestions.join(' ')}</p>
          <p class="muted">${selected.similarReason}</p>
        </div>

        <div class="form-row">
          <div>
            <label for="activities">Atividades</label>
            <textarea id="activities" rows="3">${escapeHtml(selected.form.activities)}</textarea>
          </div>
          <div>
            <label for="time">Horário (opcional)</label>
            <input id="time" type="time" value="${selected.form.time}" />
          </div>
          <div>
            <label for="notes">Observações</label>
            <textarea id="notes" rows="2">${escapeHtml(selected.form.notes)}</textarea>
          </div>
          <div>
            <label for="tags">Tags (separadas por vírgula)</label>
            <input id="tags" value="${escapeHtml(selected.form.tags)}" placeholder="ex: crianças, parque, chuva" />
            <div class="tag-preview muted">Preview: ${selected.form.tags || '-'}</div>
          </div>
          <div>
            <label for="estimated">Custo estimado (opcional)</label>
            <input id="estimated" type="number" min="0" step="0.01" value="${selected.form.estimatedCost}" />
          </div>
        </div>

        <div class="inline-actions no-print">
          <button class="secondary" id="prev-day" ${state.selectedDayIndex === 0 ? 'disabled' : ''}>Dia anterior</button>
          <button class="secondary" id="next-day" ${state.selectedDayIndex === state.days.length - 1 ? 'disabled' : ''}>Próximo dia</button>
          <button id="save-day">Salvar dia</button>
          <button id="finalize" ${!allHaveContent ? 'disabled' : ''}>Finalizar roteiro</button>
        </div>
      </section>
    </div>
  `;

  plannerEl.querySelectorAll('[data-day]').forEach((btn) => {
    btn.addEventListener('click', () => {
      persistCurrentDay();
      state.selectedDayIndex = Number(btn.dataset.day);
      renderPlanner();
    });
  });

  plannerEl.querySelector('#prev-day')?.addEventListener('click', () => {
    persistCurrentDay();
    state.selectedDayIndex -= 1;
    renderPlanner();
  });

  plannerEl.querySelector('#next-day')?.addEventListener('click', () => {
    persistCurrentDay();
    state.selectedDayIndex += 1;
    renderPlanner();
  });

  plannerEl.querySelector('#save-day').addEventListener('click', () => {
    persistCurrentDay();
    renderPlanner();
    alert('Dia salvo.');
  });

  plannerEl.querySelector('#finalize').addEventListener('click', () => {
    persistCurrentDay();
    state.trip.status = 'finalized';
    renderFinalPage();
  });

  ['activities', 'time', 'notes', 'tags', 'estimated'].forEach((id) => {
    plannerEl.querySelector(`#${id}`).addEventListener('input', persistCurrentDay);
  });
}

function persistCurrentDay() {
  const selected = state.days[state.selectedDayIndex];
  if (!selected) return;

  selected.form.activities = plannerEl.querySelector('#activities')?.value ?? selected.form.activities;
  selected.form.time = plannerEl.querySelector('#time')?.value ?? selected.form.time;
  selected.form.notes = plannerEl.querySelector('#notes')?.value ?? selected.form.notes;
  selected.form.tags = plannerEl.querySelector('#tags')?.value ?? selected.form.tags;
  selected.form.estimatedCost = plannerEl.querySelector('#estimated')?.value ?? selected.form.estimatedCost;
}

function renderFinalPage() {
  const destination = state.trip.destination;
  const costAvg = calculateAverageCosts(costBenchmarks[destination.id], state.trip.totalDays);
  const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: destination.currency_code });
  const userEstimatedTotal = state.days.reduce((acc, d) => acc + Number(d.form.estimatedCost || 0), 0);

  finalEl.innerHTML = `
    <h2>3) Página final do roteiro</h2>
    <p><strong>Destino:</strong> ${destination.nome_pt} | <strong>Período:</strong> ${state.trip.arrival} → ${state.trip.departure} | <strong>Dias:</strong> ${state.trip.totalDays}</p>

    ${state.days
      .map(
        (day) => `
      <article class="final-day">
        <h3>D${day.dayNumber} — ${day.date} (${day.weekday})</h3>
        <p><strong>Clima:</strong> ${day.weather.summary}</p>
        <p><strong>Atividades:</strong> ${escapeHtml(day.form.activities) || '-'}</p>
        <p><strong>Horário:</strong> ${day.form.time || '-'}</p>
        <p><strong>Observações:</strong> ${escapeHtml(day.form.notes) || '-'}</p>
        <p><strong>Tags:</strong> ${escapeHtml(day.form.tags) || '-'}</p>
        <p><strong>Custo estimado:</strong> ${day.form.estimatedCost ? fmt.format(Number(day.form.estimatedCost)) : '-'}</p>
      </article>
    `
      )
      .join('')}

    <div class="meta">
      <h3>Custos médios (${destination.currency_code})</h3>
      ${
        costAvg
          ? `
        <p>Transporte médio/dia × ${state.trip.totalDays}: <strong>${fmt.format(costAvg.transport)}</strong></p>
        <p>Alimentação média/dia × ${state.trip.totalDays}: <strong>${fmt.format(costAvg.food)}</strong></p>
        <p>Total médio da viagem: <strong>${fmt.format(costAvg.total)}</strong> <span class="muted">(confiança ${(costAvg.confidence * 100).toFixed(0)}%)</span></p>
      `
          : '<p>Custo médio indisponível para este destino no momento.</p>'
      }
      <p>Seu custo estimado preenchido: <strong>${fmt.format(userEstimatedTotal)}</strong></p>
    </div>

    <div class="inline-actions no-print">
      <button class="secondary" id="back-planner">Voltar ao planejamento</button>
      <button id="print-page">Imprimir / Salvar PDF</button>
      <button class="secondary" id="export-json">Exportar JSON (opcional)</button>
    </div>
  `;

  plannerEl.classList.add('hidden');
  finalEl.classList.remove('hidden');

  finalEl.querySelector('#back-planner').addEventListener('click', () => {
    finalEl.classList.add('hidden');
    plannerEl.classList.remove('hidden');
    renderPlanner();
  });

  finalEl.querySelector('#print-page').addEventListener('click', () => window.print());
  finalEl.querySelector('#export-json').addEventListener('click', exportJson);
}

function exportJson() {
  const payload = {
    trip: state.trip,
    days: state.days,
    exportedAt: new Date().toISOString(),
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `roteiro-${state.trip.destination.id}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
