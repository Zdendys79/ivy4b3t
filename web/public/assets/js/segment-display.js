/**
 * Septem Segmenta Display - Matematický displej se sedmi segmenty v 128-kové soustavě  
 * Používá progresivní systém zhasínání s permutací 1357246
 */

class SegmentDisplay {
  constructor(svgElement) {
    this.svg = svgElement;
    this.windows = [];
    this.layout = { gap: 40, width: 1200, height: 300 };
    this.winW = 200;
    this.winH = 240;
    this.angles = [90, 141.4, 192.8, 244.2, 295.6, 347, 38.4]; // 7 segmentů (360°/7) + 90° posun
    this.onColor = '#ff3b3b';
    this.currentStep = 0;
    this.startNumber = 0;
    this.maxWindows = 10; // Maximální počet číslic pro rozumnou velikost
    
    this.init();
  }
  
  init() {
    // Vytvoř maximální počet oken - budou se dynamicky zobrazovat/skrývat
    for (let i = 0; i < this.maxWindows; i++) {
      const window = this.createWindow(0, 0, this.winW, this.winH);
      this.windows.push(window);
      window.group.style.display = 'none'; // Začni skryté
    }
  }
  
  // Generuje všechny kombinace k prvků z n možných
  generateCombinations(n, k) {
    const combinations = [];
    
    function backtrack(start, current) {
      if (current.length === k) {
        combinations.push([...current]);
        return;
      }
      
      for (let i = start; i < n; i++) {
        current.push(i);
        backtrack(i + 1, current);
        current.pop();
      }
    }
    
    backtrack(0, []);
    return combinations;
  }

  // Postupné zhasínání - nejprve 1 segment, pak 2, pak 3, atd.
  generateProgressivePatterns() {
    const patterns = [];
    
    // 0 zhasnutých - všechny segmenty svítí
    patterns.push('1111111');
    
    // Pro každý počet zhasnutých segmentů (1 až 7)
    for (let zhasnutych = 1; zhasnutych <= 7; zhasnutych++) {
      const combinations = this.generateCombinations(7, zhasnutych);
      
      // Pro každou kombinaci vytvoř pattern
      combinations.forEach(positions => {
        let pattern = '1111111'.split('');
        positions.forEach(pos => {
          pattern[pos] = '0'; // zhasni segment na této pozici
        });
        patterns.push(pattern.join(''));
      });
    }
    
    return patterns;
  }

  // Aplikuje permutaci 1357246 na pattern
  applyHatPermutation(pattern) {
    // Původní pořadí: 1234567 (pozice 0123456)
    // Nové pořadí:    1357246 (pozice 0246135)
    let permuted = new Array(7);
    permuted[0] = pattern[0]; // 1→1
    permuted[2] = pattern[1]; // 2→3  
    permuted[4] = pattern[2]; // 3→5
    permuted[6] = pattern[3]; // 4→7
    permuted[1] = pattern[4]; // 5→2
    permuted[3] = pattern[5]; // 6→4
    permuted[5] = pattern[6]; // 7→6
    
    return permuted.join('');
  }

  // Získá pattern pro konkrétní cifru (0-127)
  getProgressivePatternForDigit(digit) {
    const patterns = this.generateProgressivePatterns();
    // Obrať pořadí - cifra 127 = pattern 0 (všechny segmenty), cifra 0 = pattern 127 (žádné segmenty)
    const patternIndex = 127 - digit;
    
    if (patternIndex < patterns.length) {
      const originalPattern = patterns[patternIndex];
      const permutedPattern = this.applyHatPermutation(originalPattern);
      return permutedPattern;
    }
    return '0000000';
  }

  // Vytvoření okna s jedním glyfem (7 paprsků z centra)
  createWindow(x, y, w, h, radius = 18) {
    const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    g.setAttribute('transform', `translate(${x} ${y})`);
    this.svg.appendChild(g);
    
    // Skupina segmentů
    const segGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    segGroup.setAttribute('transform', `translate(${w/2} ${h/2})`);
    g.appendChild(segGroup);
    
    const segments = [];
    const pad = 25;
    const r = Math.min(w, h)/2 - pad;
    const thickness = Math.max(10, Math.round(r * 0.18));

    this.angles.forEach((deg, i) => {
      const rad = deg * Math.PI / 180;
      const x2 = Math.cos(rad) * r;
      const y2 = -Math.sin(rad) * r;
      
      // Začátek segmentu 25% od středu
      const x1 = Math.cos(rad) * r * 0.25;
      const y1 = -Math.sin(rad) * r * 0.25;
      
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      line.setAttribute('x1', x1.toFixed(2));
      line.setAttribute('y1', y1.toFixed(2));
      line.setAttribute('x2', x2.toFixed(2));
      line.setAttribute('y2', y2.toFixed(2));
      line.setAttribute('stroke', this.onColor);
      line.setAttribute('stroke-width', thickness);
      line.setAttribute('stroke-linecap', 'round');
      line.style.display = 'none';
      segGroup.appendChild(line);
      segments.push(line);
      
      // začáteční kapička (25% od středu)
      const startCap = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      startCap.setAttribute('cx', x1.toFixed(2));
      startCap.setAttribute('cy', y1.toFixed(2));
      startCap.setAttribute('r', (thickness/2).toFixed(2));
      startCap.setAttribute('fill', this.onColor);
      startCap.style.display = 'none';
      segGroup.appendChild(startCap);
      segments.push(startCap);
      
      // koncová kapička
      const endCap = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
      endCap.setAttribute('cx', x2.toFixed(2));
      endCap.setAttribute('cy', y2.toFixed(2));
      endCap.setAttribute('r', (thickness/2).toFixed(2));
      endCap.setAttribute('fill', this.onColor);
      endCap.style.display = 'none';
      segGroup.appendChild(endCap);
      segments.push(endCap);
    });

    // API okna
    return {
      group: g,
      setBinary(binaryStr) {
        for (let i = 0; i < 7; i++) {
          const on = i < binaryStr.length && binaryStr[i] === '1';
          const line = segments[i*3];        // čára
          const startCap = segments[i*3 + 1]; // začáteční kapička
          const endCap = segments[i*3 + 2];   // koncová kapička
          
          if (on) {
            line.style.display = 'block';
            startCap.style.display = 'block';
            endCap.style.display = 'block';
          } else {
            line.style.display = 'none';
            startCap.style.display = 'none';
            endCap.style.display = 'none';
          }
        }
      }
    };
  }

  // Funkce pro centrování aktivních oken
  centerActiveWindows(activeCount) {
    // Omeť počet na dostupná okna
    const actualCount = Math.min(activeCount, this.maxWindows);
    
    // Přizpůsobit velikost oken podle počtu číslic
    let winW = this.winW;
    let gap = this.layout.gap;
    
    // Pro více než 5 číslic zmenši okna a mezery
    if (actualCount > 5) {
      const scale = Math.max(0.6, 5 / actualCount);
      winW = this.winW * scale;
      gap = this.layout.gap * scale;
    }
    
    const totalWidth = actualCount * winW + (actualCount - 1) * gap;
    const startX = (this.layout.width - totalWidth) / 2;
    const centerY = (this.layout.height - this.winH) / 2;
    
    // Skryj všechna okna nejprve
    for (let i = 0; i < this.maxWindows; i++) {
      this.windows[i].group.style.display = 'none';
    }
    
    // Zobraz a pozicuj jen aktivní okna
    for (let i = 0; i < actualCount; i++) {
      const window = this.windows[i];
      const x = startX + i * (winW + gap);
      
      // Dynamicky přizpůsob velikost
      if (actualCount > 5) {
        const scale = Math.max(0.6, 5 / actualCount);
        window.group.setAttribute('transform', `translate(${x} ${centerY}) scale(${scale})`);
      } else {
        window.group.setAttribute('transform', `translate(${x} ${centerY})`);
      }
      
      window.group.style.display = 'block';
    }
  }

  // Převede číslo na 128-kovou soustavu s dynamickým počtem číslic
  toBase128(number, minDigits = 1) {
    const digits = [];
    let num = number;
    
    // Vypočítej potřebný počet číslic
    const neededDigits = number === 0 ? 1 : Math.floor(Math.log(number) / Math.log(128)) + 1;
    const digitCount = Math.min(Math.max(neededDigits, minDigits), this.maxWindows);
    
    for (let i = 0; i < digitCount; i++) {
      digits.unshift(num % 128);
      num = Math.floor(num / 128);
    }
    
    return digits;
  }

  // Hlavní funkce pro zobrazení čísla
  displayNumber(number) {
    const base128Digits = this.toBase128(number);
    const activeCount = base128Digits.length;
    
    // Centruj aktivní okna
    this.centerActiveWindows(activeCount);
    
    // Pro každé aktivní okno nastav pattern
    for (let i = 0; i < activeCount; i++) {
      const digit = base128Digits[i];
      const pattern = this.getProgressivePatternForDigit(digit);
      this.windows[i].setBinary(pattern);
    }
  }

  // Countdown funkce - automatické odpočítávání s synchronizací na sekundy
  startCountdown(startNumber) {
    this.startNumber = startNumber;
    this.currentStep = 0;
    this.displayNumber(this.startNumber);
    
    const scheduleNextUpdate = () => {
      const now = new Date();
      const msToNextSecond = 1000 - now.getMilliseconds();
      
      setTimeout(() => {
        this.currentStep++;
        const remaining = this.startNumber - this.currentStep;
        
        if (remaining <= 0) {
          // Konec - všechny segmenty zhasnou
          this.windows.forEach(window => {
            window.setBinary('0000000');
          });
          
          // Bliknutí
          setTimeout(() => {
            document.body.style.backgroundColor = '#FFAA00';
            setTimeout(() => {
              document.body.style.backgroundColor = '#FFFFFF';
              setTimeout(() => {
                document.body.style.backgroundColor = '#0c0c12';
              }, 100);
            }, 100);
          }, 1000);
          return;
        }
        
        this.displayNumber(remaining);
        scheduleNextUpdate();
      }, msToNextSecond);
    };
    
    scheduleNextUpdate();
  }
}

// Export pro použití v jiných souborech
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SegmentDisplay;
}