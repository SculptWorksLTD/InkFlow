// Impostazioni iniziali e liste comuni. Tutto modificabile dalla sezione Impostazioni.

export const SOURCES = ['Instagram', 'Google', 'Passaparola', 'Passaggio in negozio', 'Sponsorizzata', 'TikTok', 'Fresha', 'Evento / convention', 'Partner locale', 'Cliente di ritorno', 'Altro'];
export const STYLES = ['Fine line', 'Lettering', 'Blackwork', 'Realistico', 'Tradizionale', 'Neo-tradizionale', 'Giapponese', 'Dotwork', 'Minimal', 'Acquerello', 'Cover-up', 'Altro'];
export const APPT_TYPES = ['Tatuaggio', 'Flash', 'Cover-up', 'Ritocco', 'Piercing', 'Consulenza'];
export const APPT_STATUS = {
  prenotato: 'Prenotato', confermato: 'Confermato', completato: 'Completato',
  noshow: 'Non presentato', annullato: 'Annullato',
};
export const LEAD_STATUS = {
  nuova: 'Nuova', contattata: 'Contattata', preventivo: 'Preventivo inviato',
  prenotata: 'Prenotata', persa: 'Persa',
};
export const POST_STATUS = { idea: 'Idea', pronto: 'Pronto', programmato: 'Programmato', pubblicato: 'Pubblicato' };

export const DEFAULT_SETTINGS = {
  studioName: 'Nero Ink Tattoo Shop',
  address: 'Via Vigevano 7, 20144 Milano',
  zone: 'Navigli / Porta Genova',
  phone: '+39 346 959 3629',
  instagram: '',
  bookingLink: '',
  reviewLink: '',
  formLink: '',
  artists: ['Studio'],
  defaultDeposit: 50,
  avgTicket: 200,
  targetCostPerBooking: 30,
  // 0 = lunedì … 6 = domenica; null = chiuso
  hours: [
    { open: '11:00', close: '19:30' }, { open: '11:00', close: '19:30' }, { open: '11:00', close: '19:30' },
    { open: '11:00', close: '19:30' }, { open: '11:00', close: '19:30' }, { open: '11:00', close: '19:30' }, null,
  ],
  slotMinutes: 60,
  referralReward: 20,
  anthropicKey: '',
  hashtags: '#tattoomilano #tatuaggimilano #milanotattoo #navigli #portagenova #tattooitalia #tattooartist',
  templates: {
    promemoria: 'Ciao {nome}! Ti ricordiamo l\'appuntamento da {studio} {data} alle {ora}. Mangia qualcosa prima e porta idratazione 💧. Per spostarlo scrivici qui. A presto!',
    acconto: 'Ciao {nome}, per confermare l\'appuntamento del {data} serve l\'acconto di {acconto}. Ti mando i dati per il pagamento? Senza acconto lo slot torna libero dopo 48 ore.',
    cura: 'Ciao {nome}, grazie di essere passato da {studio}! Ecco come curare il tatuaggio:\n• Togli la pellicola dopo 2-3 ore e lava con acqua tiepida e sapone neutro\n• Crema sottile 2-3 volte al giorno per 2 settimane\n• Niente sole, mare, piscina e sauna per 3 settimane\n• Non grattare le crosticine\nPer qualsiasi dubbio scrivici qui.',
    recensione: 'Ciao {nome}! Come sta guarendo il tatuaggio? Se ti sei trovato bene ci aiuteresti tantissimo con una recensione su Google, ci vogliono 30 secondi: {linkRecensione}\nGrazie di cuore 🖤',
    fotoGuarita: 'Ciao {nome}, ormai il tatuaggio dovrebbe essere guarito! Ci mandi una foto? Se serve un ritocco è gratuito, ti fissiamo un appuntamento.',
    ritorno: 'Ciao {nome}! Sono passati un po\' di mesi dal tuo ultimo tatuaggio da {studio}. Questo mese abbiamo nuovi flash e per te c\'è uno sconto riservato con il codice {codice}. Ti mando i disegni?',
    compleanno: 'Buon compleanno {nome}! 🎂 Da {studio} un regalo per te: con il codice {codice} hai 20 € su un tatuaggio o un piercing entro un mese.',
    riattivazione: 'Ciao {nome}, è passato un po\' di tempo! Da {studio} abbiamo nuovi flash e qualche data libera nelle prossime settimane. Ti va di vedere i disegni?',
    followupLead: 'Ciao {nome}, ti scrivo per la tua idea ({idea}). Hai avuto modo di pensarci? Se vuoi ti blocco una data, le prossime libere vanno via in fretta.',
    amico: 'Ciao {nome}! Se porti un amico da {studio}, lui ha {premio} di sconto e tu {premio} sul prossimo lavoro. Basta che dica il tuo codice: {codice}',
  },
};

export const PLACEHOLDERS = '{nome} {studio} {data} {ora} {acconto} {linkRecensione} {linkPrenotazione} {codice} {idea} {premio}';
