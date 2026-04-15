# Prenotazioni Sagra

Sito statico per gestire prenotazioni tavoli di una sagra, pensato per essere pubblicato anche su GitHub Pages.

## Funzioni principali

- prenotazione pubblica con scelta di data, orario, numero posti e nome
- codice prenotazione automatico per modifica o cancellazione
- area amministratore demo con credenziali `admin` / `admin`
- gestione eventi con:
  - posti totali manuali
  - tavoli componibili con calcolo automatico della capienza
- salvataggio dati nel browser tramite `localStorage`

## Pubblicazione su GitHub Pages

1. carica questi file in un repository GitHub
2. apri `Settings > Pages`
3. seleziona il branch principale come sorgente
4. pubblica dalla cartella root

## Nota importante

Essendo un sito statico, dati e login admin sono solo lato browser. Va bene per demo, prove interne o piccole gestioni locali; per uso pubblico reale servirebbe un backend con autenticazione vera e database condiviso.
