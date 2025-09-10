# ECMAScript Features - Kompletni prehled ES2015 az ES2022

Tento dokument obsahuje souhrn vsech dulezitych funkci JavaScriptu od ES2015 (ES6) az po ES2022 (ES13), ktere jsou plne podporovane v Node.js 22 LTS.

## ES2015 (ES6) - Cerven 2015

Nejvetsi aktualizace JavaScriptu, ktera zmenila zpusob psani kodu.

### Zakladni syntaxe

**Let a Const**
```javascript
let promenna = 'muze se menit';
const konstanta = 'nemuze se menit';
```

**Arrow funkce**
```javascript
// Stary zpusob
function secti(a, b) {
  return a + b;
}

// Novy zpusob
const secti = (a, b) => a + b;
```

**Template literals**
```javascript
const jmeno = 'Jan';
const vek = 25;
const zprava = `Jmenuji se ${jmeno} a je mi ${vek} let`;
```

### Destructuring

**Array destructuring**
```javascript
const cisla = [1, 2, 3];
const [prvni, druhy, treti] = cisla;
```

**Object destructuring**
```javascript
const osoba = { jmeno: 'Jan', vek: 25 };
const { jmeno, vek } = osoba;
```

### Spread a Rest operatory

**Spread**
```javascript
const arr1 = [1, 2, 3];
const arr2 = [...arr1, 4, 5]; // [1, 2, 3, 4, 5]

const obj1 = { a: 1, b: 2 };
const obj2 = { ...obj1, c: 3 }; // { a: 1, b: 2, c: 3 }
```

**Rest**
```javascript
function suma(...cisla) {
  return cisla.reduce((a, b) => a + b, 0);
}
```

### Classes

```javascript
class Zvire {
  constructor(jmeno) {
    this.jmeno = jmeno;
  }
  
  mluv() {
    console.log(`${this.jmeno} dela zvuk`);
  }
}

class Pes extends Zvire {
  mluv() {
    console.log(`${this.jmeno} steka`);
  }
}
```

### Promises

```javascript
const promise = new Promise((resolve, reject) => {
  setTimeout(() => {
    resolve('Hotovo!');
  }, 1000);
});

promise.then(vysledek => console.log(vysledek));
```

### Moduly

```javascript
// export.js
export const funkce = () => {};
export default class MojeTrida {}

// import.js
import MojeTrida, { funkce } from './export.js';
```

### Dalsi funkce

- **Map a Set** - nove datove struktury
- **Symbols** - unikatni identifikatory
- **Generators** - funkce s moznosti pozastaveni
- **Proxy** - zachytavani operaci nad objekty
- **Default parametry** - vychozi hodnoty parametru funkci
- **for...of loop** - iterace pres iterovatelne objekty

## ES2016 (ES7) - Cerven 2016

Prvni mensi, inkrementalni verze.

### Array.includes()

```javascript
const pole = [1, 2, 3, 4, 5];
console.log(pole.includes(3)); // true
console.log(pole.includes(6)); // false
```

### Exponentiation operator (**)

```javascript
// Stary zpusob
Math.pow(2, 3); // 8

// Novy zpusob
2 ** 3; // 8
```

## ES2017 (ES8) - Cerven 2017

### Async/Await

```javascript
// Promise zpusob
function fetchData() {
  return fetch('/api/data')
    .then(response => response.json())
    .then(data => console.log(data));
}

// Async/Await zpusob
async function fetchData() {
  const response = await fetch('/api/data');
  const data = await response.json();
  console.log(data);
}
```

### Object metody

**Object.values()**
```javascript
const obj = { a: 1, b: 2, c: 3 };
console.log(Object.values(obj)); // [1, 2, 3]
```

**Object.entries()**
```javascript
const obj = { a: 1, b: 2, c: 3 };
console.log(Object.entries(obj)); // [['a', 1], ['b', 2], ['c', 3]]
```

**Object.getOwnPropertyDescriptors()**
```javascript
const obj = { a: 1 };
console.log(Object.getOwnPropertyDescriptors(obj));
// { a: { value: 1, writable: true, enumerable: true, configurable: true } }
```

### String padding

```javascript
'5'.padStart(3, '0'); // '005'
'5'.padEnd(3, '0');   // '500'
```

### Trailing commas

```javascript
function funkce(
  param1,
  param2,  // povolena carka na konci
) {}
```

## ES2018 (ES9) - Cerven 2018

### Rest/Spread pro objekty

```javascript
const { a, ...zbytek } = { a: 1, b: 2, c: 3 };
console.log(a);      // 1
console.log(zbytek); // { b: 2, c: 3 }
```

### Promise.finally()

```javascript
fetch('/api/data')
  .then(response => response.json())
  .catch(error => console.error(error))
  .finally(() => console.log('Dokonceno'));
```

### Asynchronni iterace

```javascript
async function* asyncGenerator() {
  yield await Promise.resolve(1);
  yield await Promise.resolve(2);
}

for await (const hodnota of asyncGenerator()) {
  console.log(hodnota);
}
```

### RegExp vylepseni

**Named capture groups**
```javascript
const re = /(?<rok>\d{4})-(?<mesic>\d{2})-(?<den>\d{2})/;
const match = re.exec('2024-03-15');
console.log(match.groups.rok); // '2024'
```

**Lookbehind assertions**
```javascript
// Positive lookbehind
const re = /(?<=\$)\d+/;
console.log(re.exec('$100')[0]); // '100'

// Negative lookbehind
const re2 = /(?<!\$)\d+/;
```

## ES2019 (ES10) - Cerven 2019

### Array metody

**flat() a flatMap()**
```javascript
const nested = [1, [2, 3], [4, [5, 6]]];
console.log(nested.flat());    // [1, 2, 3, 4, [5, 6]]
console.log(nested.flat(2));   // [1, 2, 3, 4, 5, 6]

const arr = [1, 2, 3];
console.log(arr.flatMap(x => [x, x * 2])); // [1, 2, 2, 4, 3, 6]
```

### Object.fromEntries()

```javascript
const entries = [['a', 1], ['b', 2]];
const obj = Object.fromEntries(entries);
console.log(obj); // { a: 1, b: 2 }
```

### String metody

**trimStart() a trimEnd()**
```javascript
const str = '  Hello World  ';
console.log(str.trimStart()); // 'Hello World  '
console.log(str.trimEnd());   // '  Hello World'
```

### Optional catch binding

```javascript
// Stary zpusob
try {
  // kod
} catch (error) {
  // error se nepouziva
}

// Novy zpusob
try {
  // kod
} catch {
  // bez parametru
}
```

### Symbol.prototype.description

```javascript
const sym = Symbol('popis');
console.log(sym.description); // 'popis'
```

## ES2020 (ES11) - Cerven 2020

### BigInt

```javascript
const velke = 9007199254740992n;
const take = BigInt(9007199254740992);
console.log(velke + 1n); // 9007199254740993n
```

### Optional chaining (?.)

```javascript
const obj = {
  a: {
    b: {
      c: 'hodnota'
    }
  }
};

// Stary zpusob
if (obj && obj.a && obj.a.b && obj.a.b.c) {
  console.log(obj.a.b.c);
}

// Novy zpusob
console.log(obj?.a?.b?.c); // 'hodnota'
console.log(obj?.x?.y?.z); // undefined
```

### Nullish coalescing (??)

```javascript
// Rozdil mezi || a ??
console.log(0 || 5);         // 5 (0 je falsy)
console.log(0 ?? 5);         // 0 (0 neni null/undefined)

console.log(null ?? 'default');      // 'default'
console.log(undefined ?? 'default'); // 'default'
console.log(false ?? 'default');     // false
```

### Promise.allSettled()

```javascript
const promises = [
  Promise.resolve(1),
  Promise.reject('chyba'),
  Promise.resolve(3)
];

Promise.allSettled(promises).then(results => {
  console.log(results);
  // [
  //   { status: 'fulfilled', value: 1 },
  //   { status: 'rejected', reason: 'chyba' },
  //   { status: 'fulfilled', value: 3 }
  // ]
});
```

### String.matchAll()

```javascript
const str = 'test1test2test3';
const regex = /test(\d)/g;
const matches = [...str.matchAll(regex)];
console.log(matches);
```

### Dynamic import

```javascript
// Podmineny import
if (potrebujiModul) {
  const modul = await import('./modul.js');
  modul.funkce();
}
```

### globalThis

```javascript
// Funguje v prohlizeci i Node.js
console.log(globalThis); // globalni objekt
```

## ES2021 (ES12) - Cerven 2021

### String.replaceAll()

```javascript
const str = 'foo bar foo bar';
console.log(str.replaceAll('foo', 'baz')); // 'baz bar baz bar'
```

### Promise.any()

```javascript
const promises = [
  Promise.reject('Chyba 1'),
  Promise.reject('Chyba 2'),
  Promise.resolve('Uspech!')
];

Promise.any(promises)
  .then(result => console.log(result)) // 'Uspech!'
  .catch(errors => console.log(errors));
```

### Logical assignment operators

```javascript
// ||=
let a = null;
a ||= 5; // a = 5

// &&=
let b = 1;
b &&= 2; // b = 2

// ??=
let c = null;
c ??= 3; // c = 3
```

### Numeric separators

```javascript
const velke = 1_000_000_000;
const binarni = 0b1111_0000_1111_0000;
const hex = 0xFF_FF_FF;
```

### WeakRef

```javascript
let obj = { data: 'hodnota' };
const weakRef = new WeakRef(obj);

// Pozdeji
const deref = weakRef.deref();
if (deref) {
  console.log(deref.data);
}
```

## ES2022 (ES13) - Cerven 2022

### Top-level await

```javascript
// V modulu
const data = await fetch('/api/data').then(r => r.json());
console.log(data);
```

### Class fields

**Public fields**
```javascript
class MyClass {
  publicField = 'hodnota';
  
  constructor() {
    console.log(this.publicField);
  }
}
```

**Private fields a metody**
```javascript
class MyClass {
  #privateField = 'tajna hodnota';
  
  #privateMethod() {
    return this.#privateField;
  }
  
  publicMethod() {
    return this.#privateMethod();
  }
}
```

**Static fields a metody**
```javascript
class MyClass {
  static staticField = 'staticka hodnota';
  static #privateStaticField = 'privatni staticka';
  
  static staticMethod() {
    return this.#privateStaticField;
  }
}
```

### Array.at()

```javascript
const arr = [1, 2, 3, 4, 5];
console.log(arr.at(0));   // 1
console.log(arr.at(-1));  // 5 (posledni prvek)
console.log(arr.at(-2));  // 4 (predposledni)
```

### Object.hasOwn()

```javascript
const obj = { prop: 'hodnota' };

// Stary zpusob
obj.hasOwnProperty('prop'); // true

// Novy zpusob (bezpecnejsi)
Object.hasOwn(obj, 'prop'); // true
```

### Error cause

```javascript
try {
  // nejaky kod
} catch (err) {
  throw new Error('Neco se pokazilo', { cause: err });
}
```

### RegExp match indices

```javascript
const str = 'foo bar foo';
const regex = /(foo)/dg;
const match = regex.exec(str);
console.log(match.indices); // [[0, 3], [0, 3]]
```

## Souhrn a Best Practices

### Doporucene pouzivat

1. **const/let** misto var
2. **Arrow funkce** pro kratke funkce
3. **Template literals** pro skladani retezcu
4. **Destructuring** pro pristup k vlastnostem
5. **Async/await** misto Promise chains
6. **Optional chaining** (?.) pro bezpecny pristup
7. **Nullish coalescing** (??) misto ||
8. **Array metody** (map, filter, reduce) misto for cyklu
9. **ES moduly** misto CommonJS
10. **Classes** misto konstruktoru

### Vyhybat se

1. **var** - pouzivejte const/let
2. **arguments** - pouzivejte rest parametry
3. **for...in** pro pole - pouzivejte for...of
4. **.hasOwnProperty()** - pouzivejte Object.hasOwn()
5. **Mutujici metody** - preferujte immutabilni pristup

### Node.js 22 LTS podpora

Node.js 22 LTS plne podporuje vsechny funkce az po ES2022, takze muzete bezpecne pouzivat:
- Top-level await
- Private class fields
- Array.at()
- Object.hasOwn()
- A vsechny starsi funkce

Pro novejsi funkce (ES2023+) pouzijte TypeScript nebo Babel.