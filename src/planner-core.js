export function calculateTripDays(arrivalDate, departureDate) {
  const start = new Date(`${arrivalDate}T00:00:00Z`);
  const end = new Date(`${departureDate}T00:00:00Z`);
  const ms = end - start;
  return Math.floor(ms / (24 * 60 * 60 * 1000));
}

export function getWeekdayPtBr(dateISO, timezone) {
  const date = new Date(`${dateISO}T12:00:00Z`);
  return new Intl.DateTimeFormat('pt-BR', { weekday: 'long', timeZone: timezone }).format(date);
}

export function addDays(dateISO, offset) {
  const date = new Date(`${dateISO}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

export function climateBucket(tempC) {
  if (tempC == null) return 'fallback';
  if (tempC >= 28) return 'warm';
  if (tempC <= 12) return 'cold';
  return 'mild';
}

export function similarDayScore({ climateMatch, sameWeekday, positionMatch, destinationTypeMatch, tripLengthMatch }) {
  return (
    climateMatch * 0.4 +
    sameWeekday * 0.2 +
    positionMatch * 0.15 +
    destinationTypeMatch * 0.15 +
    tripLengthMatch * 0.1
  );
}

export function calculateAverageCosts(benchmark, tripDays) {
  if (!benchmark) return null;
  const transport = benchmark.transport_avg_per_day * tripDays;
  const food = benchmark.food_avg_per_day * tripDays;
  return { transport, food, total: transport + food, confidence: benchmark.confidence };
}
