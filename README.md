# InkFlow

Gestionale per studi di tatuaggi, pensato per Nero Ink Tattoo Shop (Milano): dalla richiesta del cliente alla cura post-tatuaggio, con contenuti social, sponsorizzate e offerte. Funziona su **Windows, Mac, iPhone e Android** come app installabile e **si aggiorna da sola**.

## Cosa fa

| Sezione | Cosa automatizza |
| --- | --- |
| **Oggi** | Ogni giorno prepara i messaggi da mandare (promemoria, acconto, cura, recensione, foto guarita, porta un amico, secondo tatuaggio, compleanno, riattivazione, richiamo richieste ferme). Un tocco: si apre WhatsApp col testo pronto. |
| **Richieste** | Bacheca per stato (nuova → contattata → preventivo → prenotata/persa), risposte pronte con le prime date libere già inserite, modulo pubblico da mettere in bio. |
| **Agenda** | Settimana, acconti, chiusura appuntamenti, esportazione nel calendario del telefono (.ics). |
| **Clienti** | Scheda con storico, consensi GDPR (marketing e foto), codice "porta un amico", spesa totale. |
| **Contenuti** | Piano di 5 uscite a settimana generato dai lavori reali con consenso foto, didascalie e hashtag locali, promemoria di pubblicazione. Solo lavoro: time-lapse, prima/dopo, guariti, flash, storia dello studio. Niente balletti. |
| **Sponsorizzate** | Modelli pronti (Meta e Google), costo per appuntamento, consiglio automatico su cosa tenere o spegnere. |
| **Offerte** | Last-minute calcolato dagli slot liberi, Flash Day, gift card con codice e saldo, classifica del passaparola. |
| **Statistiche** | Richieste, conversione, incasso, agenda piena, fonti che portano prenotazioni, motivi delle richieste perse. |

## Come si usa

L'app è pubblicata su GitHub Pages: `https://sculptworksltd.github.io/inkflow/`

- **iPhone:** Safari → Condividi → "Aggiungi alla schermata Home"
- **Android:** Chrome → ⋮ → "Installa app"
- **Windows / Mac:** Chrome o Edge → icona "Installa" nella barra dell'indirizzo

Modulo richieste per i clienti: `richiesta.html` (il link completo con i dati dello studio è in Impostazioni).

## Dati

I dati restano sul dispositivo (IndexedDB), anche offline. Per spostarli tra dispositivi: Impostazioni → Scarica backup / Importa backup. L'app ricorda di fare un backup ogni settimana.

## Aggiornamenti

Ogni modifica su `main` passa i test e viene pubblicata da `.github/workflows/deploy.yml`, che assegna una versione nuova al service worker. Le app installate scaricano la versione in background e si ricaricano da sole alla riapertura (mai mentre una finestra è aperta, per non perdere quello che si sta scrivendo).

## Sviluppo

Nessuna dipendenza e nessuna compilazione: HTML, CSS e JavaScript moderni.

```bash
npm start   # server locale su http://localhost:8080
npm test    # test della logica (automazioni, agenda, contenuti, sponsorizzate, backup)
```

Struttura: `js/logic/` contiene le regole (testate), `js/views/` le schermate, `js/db.js` l'archivio, `sw.js` il funzionamento offline e l'aggiornamento.
