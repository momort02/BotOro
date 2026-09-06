const RADIO_BROWSER_BASE = "https://all.api.radio-browser.info";
const USER_AGENT = "BotOro-Discord-Bot/1.0";

export type RadioStation = {
  uuid: string;
  name: string;
  url: string;
  codec: string;
  bitrate: number;
  countryCode: string;
};

type RawStation = {
  stationuuid: string;
  name: string;
  url_resolved: string;
  codec: string;
  bitrate: number;
  countrycode: string;
  lastcheckok: number;
};

/**
 * Recherche des stations sur radio-browser.info par nom.
 * Retourne uniquement les stations dont le dernier controle est OK,
 * triees par nombre de clics (popularite).
 */
export async function searchStations(query: string, limit = 5): Promise<RadioStation[]> {
  const params = new URLSearchParams({
    name: query,
    limit: String(limit),
    hidebroken: "true",
    order: "clickcount",
    reverse: "true"
  });

  const response = await fetch(`${RADIO_BROWSER_BASE}/json/stations/search?${params.toString()}`, {
    headers: { "User-Agent": USER_AGENT }
  });

  if (!response.ok) {
    throw new Error(`radio-browser a repondu avec le statut ${response.status}`);
  }

  const rawStations = (await response.json()) as RawStation[];
  return rawStations
    .filter((station) => station.lastcheckok === 1 && Boolean(station.url_resolved))
    .map((station) => ({
      uuid: station.stationuuid,
      name: station.name,
      url: station.url_resolved,
      codec: station.codec,
      bitrate: station.bitrate,
      countryCode: station.countrycode
    }));
}

/**
 * Signale une ecoute a radio-browser.info, comme demande par les
 * conditions d utilisation de l API (comptage de clics par station).
 * Volontairement non bloquant : un echec ici ne doit jamais empecher
 * la lecture de la radio.
 */
export function registerStationClick(uuid: string): void {
  fetch(`${RADIO_BROWSER_BASE}/json/url/${uuid}`, {
    headers: { "User-Agent": USER_AGENT }
  }).catch(() => undefined);
}