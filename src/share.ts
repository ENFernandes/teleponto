// Passar um guião do PC para o telemóvel sem servidor: o texto vai comprimido
// dentro do link, depois do "#". Essa parte nunca é enviada ao servidor que
// aloja a página (GitHub Pages); só a página no telemóvel a lê.
// Sem DOM neste ficheiro, para se poder testar com `npm test`.

/** Endereço publicado; usado quando o link é gerado a partir de localhost. */
export const PUBLIC_URL = 'https://enfernandes.github.io/teleponto/';

const HASH_KEY = 'g';

function toBase64Url(bytes: Uint8Array): string {
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64Url(text: string): Uint8Array {
    const b64 = text.replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
}

async function pipe(bytes: Uint8Array, stream: CompressionStream | DecompressionStream): Promise<Uint8Array> {
    const out = new Blob([bytes as BlobPart]).stream().pipeThrough(stream);
    return new Uint8Array(await new Response(out).arrayBuffer());
}

/** Texto → código curto para o link. "1." = comprimido; "0." = só codificado. */
export async function encodeScript(text: string): Promise<string> {
    const raw = new TextEncoder().encode(text);
    if (typeof CompressionStream !== 'undefined') {
        return '1.' + toBase64Url(await pipe(raw, new CompressionStream('deflate-raw')));
    }
    return '0.' + toBase64Url(raw);
}

export async function decodeScript(code: string): Promise<string> {
    const [version, data] = [code.slice(0, 2), code.slice(2)];
    const bytes = fromBase64Url(data);
    if (version === '1.') return new TextDecoder().decode(await pipe(bytes, new DecompressionStream('deflate-raw')));
    if (version === '0.') return new TextDecoder().decode(bytes);
    throw new Error('Link de guião inválido');
}

/** Link que abre o teleponto com o guião carregado. */
export async function buildShareUrl(text: string, base = PUBLIC_URL): Promise<string> {
    return `${base}#${HASH_KEY}=${await encodeScript(text)}`;
}

/** Lê o guião de um hash como "#g=1.xxxx"; null se não houver. */
export async function scriptFromHash(hash: string): Promise<string | null> {
    const params = new URLSearchParams(hash.replace(/^#/, ''));
    const code = params.get(HASH_KEY);
    return code ? decodeScript(code) : null;
}
