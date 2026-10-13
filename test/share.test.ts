import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import qrcode from 'qrcode-generator';
import { buildShareUrl, decodeScript, encodeScript, scriptFromHash } from '../src/share.ts';

const GUIOES = readFileSync(new URL('./fixtures/guioes.txt', import.meta.url), 'utf8')
    .split('=====').map(g => g.trim());

test('ida e volta mantém acentos, quebras de linha, parênteses retos e emojis', async () => {
    const text = 'Olá, ação à pressa!\n\n[nota: respirar] Três «aspas» — 22h 🛑';
    assert.equal(await decodeScript(await encodeScript(text)), text);
});

test('o link abre o guião certo', async () => {
    const url = await buildShareUrl(GUIOES[2]);
    assert.ok(url.startsWith('https://enfernandes.github.io/teleponto/#g=1.'));
    assert.equal(await scriptFromHash(new URL(url).hash), GUIOES[2]);
    assert.equal(await scriptFromHash(''), null);
    assert.equal(await scriptFromHash('#outra=coisa'), null);
});

test('um guião de reel cabe num código QR com folga', async () => {
    for (const g of GUIOES) {
        const url = await buildShareUrl(g);
        const qr = qrcode(0, 'L');
        qr.addData(url);
        qr.make();
        // versão 25 (117×117 módulos) ainda se lê bem num ecrã de portátil
        assert.ok(qr.getModuleCount() <= 117, `QR com ${qr.getModuleCount()} módulos para ${url.length} caracteres`);
    }
});

test('link estragado dá erro em vez de texto errado', async () => {
    await assert.rejects(() => decodeScript('9.abc'));
});
