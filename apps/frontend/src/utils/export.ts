const TOKEN_KEY = 'game_reservations_token';

async function downloadFile(url: string, filename: string): Promise<void> {
  const token = localStorage.getItem(TOKEN_KEY);
  const response = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });

  if (!response.ok) {
    throw new Error(`Export failed: ${response.statusText}`);
  }

  const blob = await response.blob();
  const objectUrl = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = objectUrl;
  a.download = filename;
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(objectUrl);
}

const BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export function exportCSV(
  arenaId: string,
  dayStart: string,
  dayEnd: string
): Promise<void> {
  const params = new URLSearchParams({
    arenaId,
    dayEnd,
    dayStart,
    format: 'csv'
  });

  return downloadFile(
    `${BASE}/export/sessions?${params}`,
    `sessions-arena-${arenaId}.csv`
  );
}

export function exportICS(
  arenaId: string,
  dayStart: string,
  dayEnd: string
): Promise<void> {
  const params = new URLSearchParams({
    arenaId,
    dayEnd,
    dayStart,
    format: 'ics'
  });

  return downloadFile(
    `${BASE}/export/sessions?${params}`,
    `sessions-arena-${arenaId}.ics`
  );
}
