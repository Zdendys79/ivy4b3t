/**
 * PARSER DAT NAROZENÍ Z UŽIVATELSKÉHO SEZNAMU
 * Extrahuje emaily a data narození pro doplnění do databáze
 */

const data = `zajani@centrum.cz    geniuS/4222    zajani@centrum.cz    7PpVcoDgF3rU    23.2.1987
SvetlankaPetrackova@seznam.cz    JsemSvetlana1983    SvetlankaPetrackova@seznam.cz    YwAwr5K39Epk    
KamcaCibulkova@seznam.cz    JsemKamila    KamcaCibulkova@seznam.cz    GrVe7dtsUoms    
vackova.viky@email.cz    vikuska93    vackova.viky@email.cz    yrtQ<o1fiJ1XtH7    
katarinamarkova@post.cz    de34cL5QBr3x    katarinamarkova@post.cz    TrbltK3hJD~Ma+#    
Zuzka.krchnakova@email.cz    mNgUZh6X3zG7    Zuzka.krchnakova@email.cz    NYWj5%{MGoywFW.    
vercahostesova@seznam.cz    joH42XFQDysp    vercahostesova@seznam.cz    7vAQkg3AKkAX    8.5.1991
zuzanasvobodna@email.cz    jsemsvobodna22    zuzanasvobodna@email.cz    zN{X%SvkIr2/.SE    14.1.1993
sasenka.jun@seznam.cz    KNCvnlciGc2R    sasenka.jun@seznam.cz    QNKtK325tM2F    
pausova.anna@seznam.cz    pausic1986    pausova.anna@seznam.cz    LovEj69ZVJhk    
synkovanikol@email.cz    nikolinka1993    synkovanikol@email.cz    ySc8tlGmeAvY    
alex.vitoch.97@gmail.com    videobydleni.cz    alex.vitoch.97@gmail.com    Alexheslo2023    
valtova.luci@seznam.cz    valtovec1991    valtova.luci@seznam.cz    valtovec1991    
sirova.martina@post.cz    NcHiXI7tBMTs    sirova.martina@post.cz    Bux9&>DyUqi&f89    
bilek725@centrum.cz    igeLIT/866    bilek725@centrum.cz    BsTz5iTknM2z    
slama@volny.cz    Emosy+700    slama@volny.cz    Emosy+700    
milanekprdly@centrum.cz    JHWqnsqPxZX2    milanekprdly@centrum.cz    rSoj1ehGXwd6    8.3.1981
svatasarka@post.cz    wCuRWdMYi3pl    svatasarka@post.cz    ip5o&&QU&vh@+R8    5.6.1992
miluska.cervinkova@seznam.cz    SFZE4n67ruNB    miluska.cervinkova@seznam.cz    SFZE4n67ruNB    9.8.1992
zajda55@centrum.cz     JAI4h3cTxbaU    zajda55@centrum.cz     g6hvF4Z}#+tCNq+    23.1.1995
bubak775@centrum.cz     uvtcL75QJluB    bubak775@centrum.cz     x?CZlRfaA;e@&r}?    14.8.1992
luckamaty1@gmail.com    ngmteH6WGZ7G    luckamaty1@gmail.com    EBt6ktLHCAMu    29.3.1977
Krchynka.Streblova@seznam.cz    Mjt2PPnxFm3u    Krchynka.Streblova@seznam.cz    Aqn68XwYg9ax    18.11.1990
Dorota.voprsalkova@seznam.cz    Z3YjYIrsuBGk    Dorota.voprsalkova@seznam.cz    Xe4FnDL5FPZS    5.3.1986
d.kopecna2@post.cz    rI5VltedJyGN    d.kopecna2@post.cz    iRawMaCNeX7Ds+h    20.7.1991
Evina.Karamela@seznam.cz    6DRRnCTojLQV    Evina.Karamela@seznam.cz    QHFoqYaLcK3G    30.3.1978
vejakukl@seznam.cz    wMcyNCTXDrwA    vejakukl@seznam.cz    YX+y3CFS3epctFV    7.2.2002
mariesrpova@email.cz    kCeslyWLP1WB    mariesrpova@email.cz    vqJejxwY4H8Q    10.12.1989
lenkakellerova@post.cz    sAXHTvpPJM12    lenkakellerova@post.cz    uSbTqZhp6q3u    21.7.2000
helcakusova@seznam.cz    njPFLfMN4rNf    helcakusova@seznam.cz    dMRfP#DRYl>,Cf1    15.3.1984
mikulova.kristyn@seznam.cz    geU7E2RhEAXx    mikulova.kristyn@seznam.cz    K7wufecBiWld    22.7.1994
raduleblahova@post.cz    WBizYcUAwDBu    raduleblahova@post.cz    kAhCEjksoE2Y    12.3.1989
marcel.voborka@seznam.cz    HK9vuZHVtPKu    marcel.voborka@seznam.cz    HK9vuZHVtPKu    11.4.1994
feroryso@centrum.cz    Lngn7rHxTD2E    feroryso@centrum.cz    T*whR.N7>EHfC{U    15.10.1991
pavla.pokorna80@post.cz    BmjJGWVU84MY    pavla.pokorna80@post.cz    Es_5,<@>&}&U2AE    18.2.1980
eva.prasilova1@post.cz    fyE92texKhzj    eva.prasilova1@post.cz    NEGhX481MbWV    
kaji.kucerova@seznam.cz    D8BDWBvYKFME    kaji.kucerova@seznam.cz    hNvXUkG>Cc}lv7G    
liskovamarketa@post.cz    Zj4b53XkhiDn    liskovamarketa@post.cz    pn1oQzEzpV8C    14.6.1982
ivantrefny.rm@seznam.cz    GiHRCWeqxQVG    ivantrefny.rm@seznam.cz    GiHRCWeqxQVG    14.9.1976
Ivankapavliku1993@email.cz    2TKRGP2FtpJk    Ivankapavliku1993@email.cz    J2LGvCWDiXNM    23.3.1993
hana.lesicka@seznam.cz    makovicka56    hana.lesicka@seznam.cz    yKVR>mE7*L@&CX7    
miskachlumcova@seznam.cz    M6aYSrbLuY8F    miskachlumcova@seznam.cz    eRu9L13Yk1hc    18.5.1993
amalkahornova@seznam.cz    IjYfQKaKnyJC    amalkahornova@seznam.cz    Lz&L*_4kd/79CCU    7.8.1992
milada.7@email.cz    NrG2VmtQNQUZ    milada.7@email.cz    ndIF98RUtvjQ    
novakovalindus@seznam.cz    F7PB4yNKXoNm    novakovalindus@seznam.cz    inJhFWEGPq47    15.4.1987
laska.k.pejskum@volny.cz    zVIIY47gjRsA    laska.k.pejskum@volny.cz    TYdjT_d/-z7z~jm    
hajlena@centrum.cz    strIKaSPaF7F    hajlena@centrum.cz    Loqyza1pxLMd    
emma.sediva@seznam.cz    brigada80    emma.sediva@seznam.cz    Emma80    9.5.1980
hedvika237@seznam.cz    RoGIddWWtc9K    hedvika237@seznam.cz    s2yJDdpQhpAq    
marcisramkova@email.cz    5FbKpyf8YHi3    marcisramkova@email.cz    xkEacQ6BRc78    
sarinka.lisa@seznam.cz    2sf3PU9ZmoQQ    sarinka.lisa@seznam.cz    1kmsct11cboT    
klaudie.kopeckova@seznam.cz    x4u6rj6krkYD    klaudie.kopeckova@seznam.cz    nLrn3/n93bfmqSm    25.5.1998
kliny1966@seznam.cz    RiSpgRsJ8YKk    kliny1966@seznam.cz    r9@jdd3y7{y2B3H    30.4.1995
geravy.geravy@seznam.cz    PYMrIABGmbli    geravy.geravy@seznam.cz    G@RIt__g@rRYmN1    
jiriholan89@seznam.cz    LkuLkw2XCmUN    jiriholan89@seznam.cz    w&AuYChIJ3ULLLE    17.5.1996
KamilNovotny87@seznam.cz    jKog8wy8yaqV    KamilNovotny87@seznam.cz    vL4X,k%}lZzx8F}    17.5.1987
KamilaNovotna89@post.cz    dVjaDRAAqZ8p    KamilaNovotna89@post.cz    po/n>Bh+ubekq7P    21.7.1989
anca.krejci186@seznam.cz    GoPRjYSYjJl6    anca.krejci186@seznam.cz    hzu64XZNMlA5    18.6.1978
kralovna.eli834@seznam.cz    mIAFsqR2kak7    kralovna.eli834@seznam.cz    DmEZ+qt.BSMqd8J    26.4.1983
dennyvoch@seznam.cz    JYB2g6urLn9J    dennyvoch@seznam.cz    D5oUvKMUd52d    29.1.1998
frantiskakucerova@email.cz    Kucerova1987    frantiskakucerova@email.cz    Kucerova1987    23.3.1987
Karina.sulcova@seznam.cz    Sulcova1996    Karina.sulcova@seznam.cz    Sulcova1996    20.2.1996
karla.perska@seznam.cz    BPUDGbyJHaCk    karla.perska@seznam.cz    lRc9HpKiQihr    29.12.1972
emmanovotna2002@seznam.cz    lmFq1tqdAfSp    emmanovotna2002@seznam.cz    hx<-BxlFCL37NNR    17.5.2002
jitkanenivesela@seznam.cz    MUQgEHwUVDBdhd5    pohoda.nehoda@seznam.cz    BGaLb2uch.N}Z3p    8.2.2001
brejjin@seznam.cz    Jindra.85    brejjin@seznam.cz    Jindra.85    11.12.1985
baumruko@seznam.cz    Ivona.79    baumruko@seznam.cz    Ivona.79    2.3.1979
radmilaslezackova@seznam.cz    Jsemradmila85    radmilaslezackova@seznam.cz    LN3YQ/4L6ipH1E-    20.3.1985
jitkapomahac@seznam.cz    JsemJitka77    jitkapomahac@seznam.cz    JsemJitka77    9.5.1962
anetaticha07@seznam.cz    Jsemaneta83    anetaticha07@seznam.cz    Jsemaneta83    4. 4. 1983
marta.vokata@seznam.cz    Ba4#U4wBmit@#7i    marta.vokata@seznam.cz    Ba4#U4wBmit@#7i    10. 3. 1998
vaclavsvatopluk@seznam.cz    K+ZzR4bWw#a&n5g    vaclavsvatopluk@seznam.cz    K+ZzR4bWw#a&n5g    25. 4. 1999
radekmarekkk@seznam.cz    p%,q@,u**7+sPQy    radekmarekkk@seznam.cz    p%,q@,u**7+sPQy    10.4.2000
potok.jezero@seznam.cz    u3{lbpe4XzzQXzx    potok.jezero@seznam.cz    u3{lbpe4XzzQXzx    19.6.2001
okno.zahrada@seznam.cz    IPi4~ekyQaRWeH_    okno.zahrada@seznam.cz    IPi4~ekyQaRWeH_01    2.1.1998
grunt.evzen@gmail.com    Sprava.b3    grunt.evzen@gmail.com    TRta1hFYwneR    15.7.1995
hlavac.ilja@gmail.com    tester.b3    hlavac.ilja@gmail.com    JAI4h3cTxbaU    4.8.1999
markojepan99@seznam.cz    mezáčekbest    markojepan99@seznam.cz    jirkajebozi    4.10.1996
Martinahrbková3@seznam.cz    Martinhrbk12    Martinahrbková3@seznam.cz    martinhrbk12    20.11.1990
PavelMusil1234@email.cz    Kotrmelec 123        pavelmusil1234    2.1.1990
erikahumpolcova@seznam.cz    UadQYVSTVMwR    erikahumpolcova@seznam.cz    UadQYVSTVMwR    18.4.1996
Hanickasalvova@seznam.cz    Salvova1992    Hanickasalvova@seznam.cz    Salvova1992    28.8.1992
sarka.bilecova91@gmail.com    wS4zG4YR4Rms    sarka.bilecova91@gmail.com        5.6.1991
anezkaholubova93@email.cz    R67VNfm2NaF8    anezkaholubova93@email.cz        5.5.1993
klara.poduskova@post.cz    N8I4MdpYTdni    klara.poduskova@post.cz    Nofuture5000    25.7.1979
martinkanovotna87@seznam.cz    mCncipDNlwF5    martinkanovotna87@seznam.cz    mCncipDNlwF5    17.5.1987
pateklindus@post.cz    @Qwertzuiopx789!987            22.7.1987
standapotrebujes@post.cz    @Qwertzuiopx789!987            20.12.1983
kocigabina@post.cz    @Qwertzuiopx789!987            18.5.1987`;

function parseBirthDates() {
  const lines = data.split('\n').filter(line => line.trim());
  const results = [];
  
  lines.forEach(line => {
    const parts = line.split(/\s+/);
    const email = parts[0];
    
    // Hledaj datum narození na konci řádku
    const lastPart = parts[parts.length - 1];
    const birthDateMatch = lastPart.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    
    if (birthDateMatch) {
      const [, day, month, year] = birthDateMatch;
      const birthDate = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
      
      results.push({
        email: email.toLowerCase(),
        birthDate,
        originalDate: lastPart
      });
    }
  });
  
  console.log('📊 EXTRAHOVANÁ DATA NAROZENÍ:');
  console.log(`Celkem nalezeno: ${results.length} dat narození\n`);
  
  results.forEach((item, i) => {
    console.log(`${i+1}. ${item.email} → ${item.birthDate} (${item.originalDate})`);
  });
  
  return results;
}

// Spuštění
parseBirthDates();