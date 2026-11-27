# Jak přispívat

Díky, že chcete pomoci. Projekt je malý a je určený na jednu hru, proto pár jednoduchých pravidel.

## Než začnete

- Potřebujete Node.js 20 nebo novější. Žádné `npm install` není potřeba.
- `npm test` spustí všechny testy, `npm start` server. Přehled architektury je v [AGENTS.md](AGENTS.md).
- Větší nápad nejdřív probereme v issue, ať se zbytečně nepracuje na něčem, co se nehodí do hry.

## Pravidla

1. **Jedna featura = jedna větev = jeden pull request.** Nepřidávejte do PR nesouvisející změny.
2. **Větve** vychází z `main` a jmenují se `feature/…`, `fix/…` nebo `docs/…`. Pokud featura stojí na jiné, ještě nezmergované, nastavte jako cíl PR její větev a mergujte popořadě.
3. **Každou featuru kontroluje vlastník repozitáře** a vyzkouší ji, než se zmerguje. V popisu PR proto vždy uveďte **jak změnu vyzkoušet**.
4. **Jazyky:**
   - kód, komentáře, názvy commitů a texty PR **anglicky**,
   - vše, co vidí hráči a vedoucí (displej, administrace, hlášky, výchozí jména), **česky**,
   - dokumentace pro uživatele (README) **česky**.
5. **Commity** mají předponu podle typu: `feat:`, `fix:`, `docs:`, `test:`, `refactor:`, `chore:` (např. `feat: add sound on event start`). Stručný popis první řádky, vysvětlení „proč“ do těla.
6. **Testy.** Logika hry musí mít testy (`test/`). Herní čas se v testech posouvá falešnými hodinami, žádné čekání. Čistá klientská logika (`public/js/*.js` bez DOM) se testuje stejně. Změny vzhledu a chování stránek vyzkoušejte ručně v prohlížeči. PR s padajícími testy se nemerguje.
7. **Žádné nové závislosti.** Aplikace musí fungovat offline po zkopírování složky: žádné CDN, fonty ani zvuky z internetu. Výjimku (soubor vložený do `public/vendor/`, včetně zdroje, licence a kontrolního součtu v `NOTICE.txt`) musí předem schválit vlastník repozitáře.
8. **Stav hry, který má přežít restart,** přidejte vždy současně do `game.serialize()` i do `parseSavedState()` (`server/saved-state.js`), případně zvyšte `version`. Autoritou je server, klienti stav jen zobrazují.
9. **Bezpečnost.** Příkazy administrace vždy za PINem a validujte je na serveru. Do repozitáře nepatří PIN, soubory `data/` ani jiná tajemství.
10. **Dokumentace.** Změnila se architektura nebo příkazy? Upravte [AGENTS.md](AGENTS.md). Změnilo se ovládání pro uživatele? Upravte [README](README.md).

## Screenshoty v README

Mění-li se vzhled displeje nebo administrace, obrázky v `docs/screenshots/` znovu vygenerujte a přiložte k PR:

```
npm run screenshots
```

Skript sám spustí server s připravenou rozehranou hrou a headless Chrome (nastavte `CHROME_PATH`, pokud ho nenajde). Potřebuje Node.js 22 nebo novější.

## Pull request

Šablona popisu se doplní sama. Zkontrolujte před odesláním:

- [ ] `npm test` prochází
- [ ] změnu jsem vyzkoušel v prohlížeči (displej i admin, pokud se jich týká)
- [ ] texty pro hráče jsou česky, kód a commity anglicky
- [ ] dokumentace a případně screenshoty jsou aktuální
