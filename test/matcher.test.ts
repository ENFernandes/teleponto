import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildKeys, detectCommand, Follower, numberToWords, similarity, tokenize } from '../src/matcher.ts';

// Textos inventados com a forma dos guiões dos reels (números, hífenes, frases parecidas).
const GUIOES = readFileSync(new URL('./fixtures/guioes.txt', import.meta.url), 'utf8')
    .split('=====').map(g => g.trim());

function follower(text: string): { f: Follower; words: string[] } {
    const words = text.split(/\s+/).filter(Boolean);
    const keys = buildKeys(words.map(word => ({ word, skip: false })));
    return { f: new Follower(keys, words.length), words };
}

/** Lê como o Chrome entrega: uma frase de cada vez, com resultados provisórios a crescer. */
function read(f: Follower, spoken: string): void {
    for (const sentence of spoken.split(/(?<=[.?!])\s+/)) {
        const toks = tokenize(sentence);
        for (let k = 1; k <= toks.length; k++) f.update(toks.slice(0, k));
    }
}

test('números por extenso em pt-PT', () => {
    assert.deepEqual(numberToWords(22), ['vinte', 'e', 'dois']);
    assert.deepEqual(numberToWords(100), ['cem']);
    assert.deepEqual(numberToWords(101), ['cento', 'e', 'um']);
    assert.deepEqual(numberToWords(1999), ['mil', 'novecentos', 'e', 'noventa', 'e', 'nove']);
    assert.deepEqual(numberToWords(2026), ['dois', 'mil', 'e', 'vinte', 'e', 'seis']);
    assert.deepEqual(numberToWords(1300), ['mil', 'e', 'trezentos']);
});

test('normalização: acentos, pontuação, horas, percentagens, hífenes', () => {
    assert.deepEqual(tokenize('Olá, telemóvel!'), ['ola', 'telemovel']);
    assert.deepEqual(tokenize('às 22h'), ['as', 'vinte', 'e', 'dois', 'horas']);
    assert.deepEqual(tokenize('22:30'), ['vinte', 'e', 'dois', 'e', 'trinta']);
    assert.deepEqual(tokenize('50%'), ['cinquenta', 'por', 'cento']);
    assert.deepEqual(tokenize('BOLO-FOFO'), ['bolo', 'fofo']);
    assert.deepEqual(tokenize('faço-lhe'), ['faco', 'lhe']);
    assert.deepEqual(tokenize('«aberto agora»'), ['aberto', 'agora']);
    assert.deepEqual(tokenize('duas'), ['dois']);
});

test('semelhança tolera uma letra trocada, mas não em palavras curtas', () => {
    assert.equal(similarity('clientes', 'cliente'), 0.8);
    assert.equal(similarity('telemovel', 'telemoveis'), 0.7);
    assert.equal(similarity('de', 'do'), 0);
    assert.equal(similarity('site', 'sitio'), 0);
});

for (const [i, guiao] of GUIOES.entries()) {
    test(`guião ${i + 1}: leitura certinha chega ao fim`, () => {
        const { f, words } = follower(guiao);
        read(f, guiao);
        assert.equal(f.currentWord(), words.length);
    });

    test(`guião ${i + 1}: chega ao fim com 1 em cada 6 palavras mal reconhecida`, () => {
        const { f, words } = follower(guiao);
        const garbled = guiao.split(/\s+/).map((w, k) => (k % 6 === 5 ? 'xpto' + k : w)).join(' ');
        read(f, garbled);
        // a última palavra pode ter sido trocada; aceita-se ficar a 1 do fim
        assert.ok(f.currentWord() >= words.length - 1, `parou na palavra ${f.currentWord()} de ${words.length}`);
    });
}

test('números ditos de outra forma: «10 segundos» e «um de novembro»', () => {
    const { f, words } = follower(GUIOES[1]);
    const spoken = GUIOES[1].replace('dez segundos', '10 segundos').replace('1 de novembro', 'um de novembro');
    read(f, spoken);
    assert.equal(f.currentWord(), words.length);
});

test('PÃO-QUENTE ouvido como «paoquente» ou «pão quente»', () => {
    for (const heard of ['paoquente', 'pão quente']) {
        const { f, words } = follower('Escreva PÃO-QUENTE na caixa.');
        read(f, `Escreva ${heard} na caixa.`);
        assert.equal(f.currentWord(), words.length, heard);
    }
});

test('repetir uma frase faz o texto voltar atrás', () => {
    const { f, words } = follower(GUIOES[2]);
    const sentences = GUIOES[2].split(/(?<=[.?!])\s+/);
    read(f, sentences.slice(0, 4).join(' '));
    const afterFour = f.currentWord();
    // volta a dizer o início da frase 3 ("Se abrir a porta antes do tempo...")
    const start3 = words.indexOf('Se');
    const toks = tokenize(sentences[3]);
    for (let k = 1; k <= 5; k++) f.update(toks.slice(0, k));
    assert.ok(f.currentWord() < afterFour, 'devia ter voltado atrás');
    assert.ok(f.currentWord() >= start3 && f.currentWord() <= start3 + 6, `está em ${f.currentWord()}, frase começa em ${start3}`);
    // e continua até ao fim
    read(f, sentences.slice(3).join(' '));
    assert.equal(f.currentWord(), words.length);
});

test('uma palavra pequena sozinha não faz saltar à frente', () => {
    const { f } = follower('Antes de mudar seja o que for, provo o que o cliente prova');
    f.update(['o']);
    assert.equal(f.currentWord(), 0);
    f.update(['que']);
    assert.equal(f.currentWord(), 0);
});

test('conversa que não está no guião não mexe', () => {
    const { f } = follower(GUIOES[0]);
    read(f, 'Espera, vou beber água e já recomeço.');
    assert.equal(f.currentWord(), 0);
});

test('palavra repetida no guião: não salta duas de uma vez', () => {
    const { f } = follower('isto é muito muito bom');
    f.update(['isto', 'e', 'muito']);
    assert.equal(f.currentWord(), 3);
    f.update(['isto', 'e', 'muito']); // o mesmo resultado provisório outra vez
    assert.equal(f.currentWord(), 3);
    f.update(['isto', 'e', 'muito', 'muito']);
    assert.equal(f.currentWord(), 4);
});

test('salto grande à frente precisa de várias palavras certas', () => {
    const { f, words } = follower(GUIOES[0]);
    // salta o primeiro parágrafo e começa a ler o segundo
    read(f, 'Antes de mudar seja o que for');
    const at = f.currentWord();
    assert.ok(at > words.indexOf('Antes') && at <= words.indexOf('for,') + 1, `está em ${at}`);
});

test('tocar numa palavra põe a posição lá', () => {
    const { f, words } = follower(GUIOES[0]);
    f.syncToWord(words.indexOf('Porque'));
    assert.equal(f.currentWord(), words.indexOf('Porque'));
    read(f, 'Porque é aí que um cliente decide');
    assert.equal(f.currentWord(), words.indexOf('decide') + 1);
});

test('comandos de voz em português', () => {
    const keys = buildKeys('Faço bolos para pequenas festas'.split(' ').map(word => ({ word, skip: false })));
    assert.equal(detectCommand(tokenize('pronto volta atrás'), keys, 0), 'back');
    assert.equal(detectCommand(tokenize('volta ao início'), keys, 0), 'start');
    assert.equal(detectCommand(tokenize('salta à frente'), keys, 0), 'next');
    assert.equal(detectCommand(tokenize('bolos'), keys, 0), null);
    // se o guião diz "volta atrás" ali perto, é leitura, não comando
    const k2 = buildKeys('E depois volta atrás no texto'.split(' ').map(word => ({ word, skip: false })));
    assert.equal(detectCommand(tokenize('e depois volta atrás'), k2, 2), null);
});
