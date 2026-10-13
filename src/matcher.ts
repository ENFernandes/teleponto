// Seguimento da voz: alinha o que o reconhecedor ouviu com o guião.
//
// O guião e o que se ouve passam pela mesma normalização (minúsculas, sem
// acentos nem pontuação, números por extenso), e cada palavra do guião vira uma
// ou mais "chaves" ("22h" → vinte e dois horas). A posição avança quando o fim
// do que foi dito encaixa nas chaves à frente; recua quando se repete uma frase.
// Este ficheiro não toca no DOM, para se poder testar com `npm test`.

export interface MatchKey {
    key: string;
    word: number; // índice da palavra do guião a que a chave pertence
    stop: boolean; // palavra pequena e frequente ("de", "o", "que"...)
}

// ── Normalização ────────────────────────────────────────────────────────────

const STOPWORDS = new Set([
    'a', 'o', 'as', 'os', 'um', 'uns', 'umas', 'de', 'do', 'da', 'dos', 'das', 'e', 'em',
    'no', 'na', 'nos', 'nas', 'num', 'numa', 'que', 'se', 'por', 'para', 'pra', 'com', 'ao',
    'aos', 'pelo', 'pela', 'me', 'te', 'lhe', 'eu', 'ou', 'mas', 'ja', 'so', 'ha', 'seu',
    'sua', 'seus', 'suas', 'meu', 'minha', 'isso', 'isto', 'este', 'esta', 'esse', 'essa',
    'como', 'mais', 'muito'
]);

// Formas que o reconhecedor pode escrever de outra maneira (género dos números, pt-BR).
const ALIASES: Record<string, string> = {
    uma: 'um', duas: 'dois', quatorze: 'catorze', dezesseis: 'dezasseis',
    dezessete: 'dezassete', dezenove: 'dezanove', duzentas: 'duzentos',
    trezentas: 'trezentos', quatrocentas: 'quatrocentos', quinhentas: 'quinhentos',
    seiscentas: 'seiscentos', setecentas: 'setecentos', oitocentas: 'oitocentos',
    novecentas: 'novecentos', primeira: 'primeiro', segunda: 'segundo', terceira: 'terceiro'
};

const UNITS = ['zero', 'um', 'dois', 'tres', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove',
    'dez', 'onze', 'doze', 'treze', 'catorze', 'quinze', 'dezasseis', 'dezassete', 'dezoito', 'dezanove'];
const TENS = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
const HUNDREDS = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos',
    'setecentos', 'oitocentos', 'novecentos'];
const ORDINALS = ['', 'primeiro', 'segundo', 'terceiro', 'quarto', 'quinto', 'sexto', 'setimo',
    'oitavo', 'nono', 'decimo'];

function below1000(n: number): string[] {
    if (n < 20) return [UNITS[n]];
    if (n < 100) {
        const t = Math.floor(n / 10), u = n % 10;
        return u ? [TENS[t], 'e', UNITS[u]] : [TENS[t]];
    }
    if (n === 100) return ['cem'];
    const h = Math.floor(n / 100), rest = n % 100;
    return rest ? [HUNDREDS[h], 'e', ...below1000(rest)] : [HUNDREDS[h]];
}

/** Número inteiro por extenso em pt-PT, em palavras normalizadas (sem acentos). */
export function numberToWords(n: number): string[] {
    if (!Number.isInteger(n) || n < 0 || n >= 1_000_000) return [String(n)];
    if (n < 1000) return below1000(n);
    const th = Math.floor(n / 1000), rest = n % 1000;
    const thousands = th === 1 ? ['mil'] : [...below1000(th), 'mil'];
    if (!rest) return thousands;
    // "mil e vinte", "mil e trezentos", mas "mil trezentos e vinte"
    const joiner = rest < 100 || rest % 100 === 0 ? ['e'] : [];
    return [...thousands, ...joiner, ...below1000(rest)];
}

function numberForm(p: string): string[] | null {
    let m: RegExpMatchArray | null;
    if ((m = p.match(/^\d{1,3}(?:\.\d{3})+$/))) return numberToWords(parseInt(p.replace(/\./g, ''), 10));
    if ((m = p.match(/^(\d+)$/))) return numberToWords(parseInt(m[1], 10));
    if ((m = p.match(/^(\d+)h(\d+)?$/))) {
        const out = [...numberToWords(parseInt(m[1], 10)), 'horas'];
        return m[2] && parseInt(m[2], 10) ? [...out, 'e', ...numberToWords(parseInt(m[2], 10))] : out;
    }
    if ((m = p.match(/^(\d+):(\d+)$/))) {
        const min = parseInt(m[2], 10);
        const h = numberToWords(parseInt(m[1], 10));
        return min ? [...h, 'e', ...numberToWords(min)] : [...h, 'horas'];
    }
    if ((m = p.match(/^(\d+)%$/))) return [...numberToWords(parseInt(m[1], 10)), 'por', 'cento'];
    if ((m = p.match(/^(\d+)€$/))) return [...numberToWords(parseInt(m[1], 10)), 'euros'];
    if ((m = p.match(/^(\d+),(\d+)$/))) {
        return [...numberToWords(parseInt(m[1], 10)), 'virgula', ...numberToWords(parseInt(m[2], 10))];
    }
    if ((m = p.match(/^(\d+)\.?[ºª]$/))) {
        const n = parseInt(m[1], 10);
        return n >= 1 && n <= 10 ? [ORDINALS[n]] : numberToWords(n);
    }
    return null;
}

/** Parte um texto (guião ou transcrição) em palavras normalizadas. */
export function tokenize(text: string): string[] {
    const out: string[] = [];
    const parts = text.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
        .split(/[\s\-‐–—/]+/);
    for (const part of parts) {
        const p = part.replace(/^[^\p{L}\p{N}]+/u, '').replace(/[^\p{L}\p{N}%€ºª]+$/u, '');
        if (!p) continue;
        const nums = numberForm(p);
        if (nums) {
            out.push(...nums);
            continue;
        }
        const clean = p.replace(/[^\p{L}\p{N}]/gu, '');
        if (clean) out.push(ALIASES[clean] ?? clean);
    }
    return out;
}

/** Chaves de comparação para as palavras do guião (as saltadas não geram chaves). */
export function buildKeys(words: { word: string; skip: boolean }[]): MatchKey[] {
    const keys: MatchKey[] = [];
    words.forEach((w, i) => {
        if (w.skip) return;
        for (const key of tokenize(w.word)) keys.push({ key, word: i, stop: STOPWORDS.has(key) });
    });
    return keys;
}

// ── Semelhança entre palavras ──────────────────────────────────────────────

/** Distância de Levenshtein: quantas letras é preciso mudar para ir de a a b. */
export function levenshtein(a: string, b: string, max = 3): number {
    if (Math.abs(a.length - b.length) > max) return max + 1;
    let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
    for (let i = 1; i <= a.length; i++) {
        const cur = [i];
        let rowMin = i;
        for (let j = 1; j <= b.length; j++) {
            const v = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
            cur.push(v);
            if (v < rowMin) rowMin = v;
        }
        if (rowMin > max) return max + 1;
        prev = cur;
    }
    return prev[b.length];
}

/** 1 = igual; 0,7–0,8 = quase igual (o reconhecedor trocou uma ou duas letras); 0 = diferente. */
export function similarity(a: string, b: string): number {
    if (a === b) return 1;
    const shortest = Math.min(a.length, b.length);
    if (shortest < 4) return 0; // palavras curtas só contam se forem iguais
    const d = levenshtein(a, b, 2);
    if (d <= 1) return 0.8;
    if (shortest >= 7 && d <= 2) return 0.7;
    return 0;
}

// ── Alinhamento ────────────────────────────────────────────────────────────

const TAIL = 8; // quantas palavras ouvidas se usam de cada vez
const AHEAD = 40; // até onde se procura à frente
const BACK = 60; // até onde se procura para trás (frase repetida)
const MISS_PENALTY = 0.3;

interface Alignment { score: number; strong: number; misses: number; earliest: number }

/**
 * Pontua o encaixe das últimas palavras ouvidas (S) a acabar na chave j do guião,
 * andando para trás. A última palavra ouvida tem de encaixar em j.
 */
function align(S: string[], keys: MatchKey[], j: number): Alignment | null {
    let i = S.length - 1, k = j, score = 0, strong = 0, misses = 0, first = true, earliest = j;
    const take = (kk: number, s: number) => {
        score += s * (keys[kk].stop ? 0.5 : 1);
        if (!keys[kk].stop) strong++;
        earliest = kk;
    };
    while (i >= 0 && k >= 0 && misses <= 2) {
        const s = similarity(S[i], keys[k].key);
        if (s > 0) { take(k, s); i--; k--; first = false; continue; }
        // "check up" ouvido como duas palavras, guião com uma ("checkup")
        if (i >= 1 && S[i - 1] + S[i] === keys[k].key) { take(k, 1); i -= 2; k--; first = false; continue; }
        // o contrário: guião "check-up" (duas chaves), ouvido "checkup"
        if (k >= 1 && keys[k - 1].key + keys[k].key === S[i]) { take(k, 1); earliest = k - 1; i--; k -= 2; first = false; continue; }
        if (first) return null;
        if (i >= 1 && similarity(S[i - 1], keys[k].key) > 0) { i--; misses++; continue; } // palavra a mais
        if (k >= 1 && similarity(S[i], keys[k - 1].key) > 0) { k--; misses++; continue; } // palavra não ouvida
        i--; k--; misses++; // palavra trocada
    }
    return { score: score - misses * MISS_PENALTY, strong, misses, earliest };
}

export class Follower {
    /** Índice da próxima chave a dizer. */
    pos = 0;
    keys: MatchKey[];
    private wordCount: number;

    constructor(keys: MatchKey[], wordCount: number) {
        this.keys = keys;
        this.wordCount = wordCount;
    }

    /** Índice da palavra atual do guião (a próxima a ler). */
    currentWord(): number {
        return this.pos < this.keys.length ? this.keys[this.pos].word : this.wordCount;
    }

    /** Põe a posição na palavra indicada (toque numa palavra, recomeçar, saltar parágrafo). */
    syncToWord(wordIndex: number): void {
        const idx = this.keys.findIndex(k => k.word >= wordIndex);
        this.pos = idx === -1 ? this.keys.length : idx;
    }

    /**
     * Recebe as palavras ouvidas (já normalizadas) e move a posição se encaixarem.
     * `lookahead`: até quantas chaves à frente basta uma palavra para avançar.
     * Devolve true se a posição mudou.
     */
    update(spoken: string[], lookahead = 5): boolean {
        const S = spoken.slice(-TAIL);
        if (S.length === 0 || this.keys.length === 0) return false;

        const pos = this.pos;
        let best: { j: number; score: number } | null = null;
        const from = Math.max(0, pos - BACK);
        const to = Math.min(this.keys.length - 1, pos + AHEAD);

        for (let j = from; j <= to; j++) {
            const r = align(S, this.keys, j);
            if (!r) continue;
            const d = j - pos;
            let ok: boolean;
            if (d === -1 || d === 0) ok = true; // ficar onde está, ou a palavra seguinte
            // perto: basta uma palavra que não seja pequena, ou ter ouvido sem falhas
            // tudo desde a posição atual até j ("isto é muito" dito de uma vez)
            else if (d > 0 && d <= lookahead) ok = !this.keys[j].stop || r.score >= 2 || (r.misses === 0 && r.earliest <= pos);
            else if (d > 0) ok = r.score >= 2.5 && r.strong >= 2; // salto grande à frente
            else ok = r.score >= 3 && r.strong >= 2; // voltar atrás: frase repetida
            if (!ok) continue;

            if (!best || r.score > best.score + 1e-9 ||
                (Math.abs(r.score - best.score) <= 1e-9 &&
                    Math.abs(j - (pos - 1)) < Math.abs(best.j - (pos - 1)))) {
                best = { j, score: r.score };
            }
        }

        if (!best) return false;
        const next = best.j + 1;
        if (next === pos) return false;
        this.pos = next;
        return true;
    }
}

// ── Comandos de voz ────────────────────────────────────────────────────────

export type VoiceCommand = 'start' | 'back' | 'next' | 'finish';

const COMMANDS: { name: VoiceCommand; words: string[] }[] = [
    { name: 'start', words: ['volta', 'ao', 'inicio'] },
    { name: 'back', words: ['volta', 'atras'] },
    { name: 'next', words: ['salta', 'a', 'frente'] },
    { name: 'finish', words: ['vai', 'para', 'o', 'fim'] }
];

/** Frases dos comandos, para mostrar na interface. */
export const COMMAND_PHRASES = '«volta ao início», «volta atrás», «salta à frente», «vai para o fim»';

/**
 * Devolve o comando se as últimas palavras ouvidas forem um comando que não
 * aparece no guião ali perto (para não confundir leitura com comando).
 */
export function detectCommand(spoken: string[], keys: MatchKey[], pos: number): VoiceCommand | null {
    for (const c of COMMANDS) {
        const n = c.words.length;
        if (spoken.length < n) continue;
        const tail = spoken.slice(-n);
        if (!tail.every((w, i) => w === c.words[i])) continue;
        const from = Math.max(0, pos - 6), to = Math.min(keys.length, pos + 12);
        let inScript = false;
        for (let j = from; j + n <= to && !inScript; j++) {
            inScript = c.words.every((w, i) => keys[j + i].key === w);
        }
        if (!inScript) return c.name;
    }
    return null;
}
