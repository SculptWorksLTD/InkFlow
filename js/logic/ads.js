// Sponsorizzate: metriche e consigli automatici. Il criterio è il costo per appuntamento, non i like.

import { daysBetween } from '../util.js';

export const PLATFORMS = ['Instagram/Facebook', 'Google Ads', 'TikTok', 'Altro'];

export const PRESETS = [
  {
    name: 'Messaggi in DM – reel migliore', platform: 'Instagram/Facebook', dailyBudget: 7,
    setup: 'Obiettivo "Messaggi" (Interazione → Instagram Direct). Pubblico: raggio 4 km da via Vigevano, 18-40 anni, interessi tatuaggi/arte/musica. Creatività: il time-lapse con più salvataggi del mese. Attiva la risposta automatica ai DM.',
  },
  {
    name: 'Flash Day', platform: 'Instagram/Facebook', dailyBudget: 10,
    setup: 'Parte 5 giorni prima del Flash Day. Obiettivo "Messaggi" o "Copertura" locale, raggio 6 km. Creatività: carosello dei flash con prezzo. Si spegne il giorno dell\'evento.',
  },
  {
    name: 'Ricerca Google ad alta intenzione', platform: 'Google Ads', dailyBudget: 8,
    setup: 'Campagna sulla rete di ricerca, località: Milano. Parole chiave a corrispondenza a frase: "tatuatore navigli", "tattoo porta genova", "cover up tatuaggio milano", "piercing navigli". Escludi "corso", "lavoro", "gratis". Estensione di chiamata e di località attive.',
  },
  {
    name: 'Retargeting chi ha visitato il profilo', platform: 'Instagram/Facebook', dailyBudget: 4,
    setup: 'Pubblico personalizzato: persone che hanno interagito con il profilo Instagram negli ultimi 60 giorni, escluse quelle che ti hanno già scritto. Creatività: recensioni e guariti.',
  },
];

export function metrics(c, today = new Date()) {
  const spent = Number(c.spent) || 0;
  const msgs = Number(c.messages) || 0;
  const bookings = Number(c.bookings) || 0;
  const revenue = Number(c.revenue) || 0;
  const days = c.start ? Math.max(1, daysBetween(new Date(c.start), c.end && new Date(c.end) < today ? new Date(c.end) : today) + 1) : 0;
  return {
    spent, msgs, bookings, revenue, days,
    costPerMessage: msgs ? spent / msgs : null,
    costPerBooking: bookings ? spent / bookings : null,
    conversion: msgs ? bookings / msgs : null,
    roas: spent ? revenue / spent : null,
  };
}

// Consiglio semplice e spiegato, basato su soglie configurabili.
export function advice(c, settings, today = new Date()) {
  const m = metrics(c, today);
  const target = Number(settings.targetCostPerBooking) || 30;
  if (c.status === 'ferma') return { level: 'neutral', text: 'Campagna ferma.' };
  if (m.days < 4 || m.spent < 20) return { level: 'neutral', text: 'Troppo presto per giudicare: aspetta almeno 4 giorni e 20 € spesi.' };
  if (m.msgs === 0) return { level: 'bad', text: 'Nessun messaggio: cambia creatività (usa il reel con più salvataggi) o restringi il pubblico.' };
  if (m.bookings === 0 && m.spent >= target * 2) return { level: 'bad', text: `Spesi ${Math.round(m.spent)} € senza appuntamenti. Spegnila, oppure controlla come rispondete ai DM: i messaggi arrivano ma non si chiudono.` };
  if (m.costPerBooking != null && m.costPerBooking <= target) return { level: 'good', text: `Funziona: ${Math.round(m.costPerBooking)} € per appuntamento (obiettivo ${target} €). Alza il budget del 20% e ricontrolla tra 5 giorni.` };
  if (m.costPerBooking != null) return { level: 'warn', text: `${Math.round(m.costPerBooking)} € per appuntamento, sopra l'obiettivo di ${target} €. Prova una nuova creatività prima di spendere di più.` };
  return { level: 'warn', text: 'Arrivano messaggi ma ancora nessun appuntamento: rispondi entro un\'ora e proponi subito una data.' };
}
