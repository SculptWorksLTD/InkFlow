// Piano contenuti per i social. Niente balletti né trend da ballare:
// solo formati che mostrano il lavoro, che per uno studio sono quelli che portano clienti.

import { addDays, startOfWeek, ymd } from '../util.js';

export const FORMATS = {
  timelapse: {
    label: 'Reel time-lapse del lavoro', goal: 'Farsi scoprire',
    how: 'Telefono su treppiede sopra la postazione, inquadratura fissa, 20-40 secondi accelerati. Finale con il tatuaggio pulito e la luce buona. Nessuna faccia richiesta.',
    hook: ['Da uno stencil a questo in {ore} ore', '{stile} su {zona}: il processo completo', 'Guarda come nasce un {stile}'],
  },
  primaDopo: {
    label: 'Carosello prima / dopo', goal: 'Dimostrare abilità',
    how: '3-6 foto: idea o reference, stencil, fresco, guarito. Funziona benissimo con i cover-up.',
    hook: ['Prima e dopo: {stile} su {zona}', 'Da questo a questo. Cover-up in {ore} ore', 'Fresco vs guarito, senza filtri'],
  },
  flash: {
    label: 'Flash disponibili a prezzo fisso', goal: 'Vendere subito',
    how: 'Foto del foglio flash o carosello dei disegni con il prezzo scritto. Chiamata all\'azione: scrivi FLASH in DM.',
    hook: ['Flash della settimana, prezzo fisso', 'Questi disegni si fanno una volta sola', 'Scegli il tuo flash, scrivici FLASH'],
  },
  slot: {
    label: 'Storia con gli slot liberi', goal: 'Riempire i buchi',
    how: 'Storia semplice con le date libere dei prossimi giorni. Sticker "link" alla prenotazione o "scrivici".',
    hook: ['Posti liberi questa settimana', 'Ultimi slot prima del weekend', 'Si è liberato un posto domani'],
  },
  fiducia: {
    label: 'Recensione o dietro le quinte', goal: 'Fiducia',
    how: 'Screenshot di una recensione Google, oppure pulizia della postazione, materiale sterile, disegno a mano. Mostra la serietà, non serve parlare in camera.',
    hook: ['Cosa dicono di noi', 'Igiene prima di tutto: come prepariamo la postazione', 'Dal disegno a mano alla pelle'],
  },
  guarito: {
    label: 'Foto guarita del cliente', goal: 'Prova di qualità',
    how: 'Ripubblica la foto guarita che ti manda il cliente (con il suo consenso). Il guarito convince più del fresco.',
    hook: ['Guarito dopo 4 settimane', 'Così invecchia un buon {stile}', 'Il vero test è il guarito'],
  },
  sedici: {
    label: 'Storia dello studio', goal: 'Autorevolezza',
    how: 'Un lavoro o un ricordo dagli archivi: lo studio esiste da oltre 16 anni, è il tuo vantaggio rispetto agli studi nuovi.',
    hook: ['16 anni in via Vigevano', 'Tatuaggi fatti 10 anni fa, visti oggi', 'Da quando abbiamo aperto'],
  },
};

// Settimana tipo: 5 uscite. Giorni 0=lunedì … 6=domenica.
export const WEEK_PLAN = [
  { day: 0, format: 'timelapse', platforms: ['Instagram', 'TikTok', 'Facebook'] },
  { day: 1, format: 'primaDopo', platforms: ['Instagram', 'Facebook'] },
  { day: 3, format: 'flash', platforms: ['Instagram', 'Facebook'] },
  { day: 4, format: 'slot', platforms: ['Instagram (storia)'] },
  { day: 6, format: 'fiducia', platforms: ['Instagram', 'Google'] },
];

// Genera le uscite di una settimana; se ci sono lavori recenti li collega ai formati che ne hanno bisogno.
export function planWeek({ weekStart = startOfWeek(), recentWork = [], existing = [], weekIndex = 0 }) {
  const taken = new Set(existing.map((p) => `${p.date}:${p.format}`));
  const work = [...recentWork];
  const posts = [];
  WEEK_PLAN.forEach((slot, i) => {
    let format = slot.format;
    // una settimana su tre il contenuto "fiducia" diventa storia dello studio, una su tre guarito
    if (format === 'fiducia' && weekIndex % 3 === 1) format = 'sedici';
    if (format === 'fiducia' && weekIndex % 3 === 2) format = 'guarito';
    const date = ymd(addDays(weekStart, slot.day));
    if (taken.has(`${date}:${format}`)) return;
    const needsWork = ['timelapse', 'primaDopo', 'guarito'].includes(format);
    const src = needsWork ? work.shift() : null;
    posts.push({
      date, format, platforms: slot.platforms, status: 'idea',
      appointmentId: src?.id || null,
      title: FORMATS[format].label + (src?.description ? ` – ${src.description}` : ''),
      _i: i,
    });
  });
  return posts;
}

export function captionFor({ format, work = {}, settings, variant = 0 }) {
  const f = FORMATS[format] || FORMATS.timelapse;
  const vars = {
    stile: (work.style || 'tatuaggio').toLowerCase(),
    zona: work.bodyPart || 'pelle',
    ore: work.durationMin ? Math.max(1, Math.round(work.durationMin / 60)) : 'poche',
  };
  const hook = f.hook[variant % f.hook.length].replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
  const cta = format === 'flash' ? 'Scrivi FLASH in DM per prenotare il tuo.'
    : format === 'slot' ? 'Scrivici in DM o prenota dal link in bio.'
      : 'Prenota la tua consulenza gratuita: link in bio o scrivici in DM.';
  const place = `📍 ${settings.studioName}, ${settings.zone || 'Milano'}`;
  const styleTag = work.style ? ` #${work.style.toLowerCase().replace(/[^a-z]/g, '')}tattoo` : '';
  return `${hook[0].toUpperCase()}${hook.slice(1)}.\n\n${cta}\n${place}\n\n${settings.hashtags}${styleTag}`;
}

// Prompt per generare didascalie con l'IA (facoltativo, richiede una chiave API nelle impostazioni).
export function aiPrompt({ format, work = {}, settings }) {
  const f = FORMATS[format] || FORMATS.timelapse;
  return `Scrivi 3 didascalie Instagram in italiano per lo studio di tatuaggi "${settings.studioName}" (${settings.address}, zona ${settings.zone}, aperto da oltre 16 anni).
Contenuto: ${f.label}. Obiettivo: ${f.goal}.
Lavoro: stile ${work.style || 'non indicato'}, zona del corpo ${work.bodyPart || 'non indicata'}, durata ${work.durationMin ? Math.round(work.durationMin / 60) + ' ore' : 'non indicata'}, descrizione: ${work.description || '-'}.
Regole: tono diretto e professionale, niente trend o balletti, massimo 3 frasi, chiudi sempre con una chiamata all'azione (DM o link in bio), poi una riga con la posizione e una con 8-12 hashtag locali (Milano, Navigli) e di stile. Separa le 3 didascalie con una riga "---".`;
}
