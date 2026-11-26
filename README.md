# oxygen-indicator


## Popis architektury a funkcionality

Cílem této jednodué aplikace je vytvořit herní UI pro hornickou společenskou hru na víkendovku pro děcka v 8.-9. třídě ZŠ. Děcka jsou ve hře rozdělená do jedntolivých rolí. 2 z nich jsou i horník a operátor. Horník se pohybuje v toxickém prostředí. Aby mohl dýchat, musí mít neustále přísun kyslíku. Nad dostatkem kyslíku dbá mimo jiné operátor. Ten sleduje jeho stav a pokud je ho třeba doplnit, dopní ho. Ve hře jsou vždy 4 tými. Tato aplikace by měla simulovat kolik kyslíku horníkům zbývá. Představuju si jednoduchou webovou stránku - je univerzální, běží na jakémkoliv OS a není třeba internet, pokud se stáhne dopředu. Aplikace by zobrazovala 4 ukazatele, které by zobrazovaly, kolik kyslíku hroníkům zbývá. Pokud by nějaký docházel, PC by začal vydávat zvuky. Operátor by musel k PC přiběhnout, zvolit jméno, případně ukazatel svého horníka a doplnit mu kyskík tak, že bude klikat. Myší nějakou dobu.

Odhad je, že kyslíková maska by měla vystačit cca 2 min bez klikání. Čas bych ale rád geluloval z mobilu. Zároveň také rád dostal upozornění, pokud kyslík vyprší. Moje idea je, že by na PC běžel jednoduchý server na node js. Zobrazoval by stránku. PC by ale dělal hotspot a ten by umožňoval měnit konfiguraci pomocí jednoduché administrace v které by bylo možné:
- dávat jména horníkům
- mít přehled komu kdy vypršel kyslík pro další postihy
- vyhlašovat speciální události, např. prasklá bomba a kyslík dochází 2x rychle
- a regulovat rychlosto docházení kyslíku, případně pauznout kyslík

- také by se mi líbilo mít preset rychlosti spotřeby kyslíku, pro práci, normál a spánek, tj. u spánku by došel např. za 2x tak dlouho, u práce by docházel např i za 1 min. Tedy hranice by mohly být 4 min spánek, 2 min stanrad, 1 min práce.

Operátor nemusí doplnit kyslík naplno.

Kyslík může doplňovat vždy jen jeden operátor - jeden PC.

Navrhni případně i další zlepšení.