import qrcode from 'qrcode-generator';
import { els } from './elements';
import { buildShareUrl, PUBLIC_URL, scriptFromHash } from './share';

// No PC: "Enviar para o telemóvel" mostra um QR com o guião dentro do link.
// No telemóvel: abrir esse link carrega o guião e guarda-o nos recentes.

let currentLink = '';
let toastTimer: ReturnType<typeof setTimeout> | null = null;

export function showToast(message: string, ms = 5000): void {
    els.toast.textContent = message;
    els.toast.classList.remove('hidden');
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.add('hidden'), ms);
}

/** Em localhost o telemóvel não chega ao PC: o link aponta para a versão publicada. */
function linkBase(): string {
    const { protocol, hostname, origin, pathname } = location;
    const local = protocol !== 'https:' || hostname === 'localhost' || hostname === '127.0.0.1';
    return local ? PUBLIC_URL : origin + pathname;
}

async function openSendModal(): Promise<void> {
    const text = els.inputScript.value.trim();
    if (!text) {
        showToast('Cole primeiro o guião.');
        return;
    }
    currentLink = await buildShareUrl(text, linkBase());
    const qr = qrcode(0, 'L');
    qr.addData(currentLink);
    qr.make();
    els.sendToPhoneQr.innerHTML = qr.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
    els.sendToPhoneModal.classList.remove('hidden');
}

function closeSendModal(): void {
    els.sendToPhoneModal.classList.add('hidden');
}

async function receiveFromHash(onReceive: (text: string) => void): Promise<void> {
    if (!location.hash) return;
    const clearHash = () => history.replaceState(null, '', location.pathname + location.search);
    try {
        const text = await scriptFromHash(location.hash);
        if (text === null) return;
        clearHash(); // não voltar a carregar o mesmo guião ao recarregar
        onReceive(text);
        showToast('Guião recebido do PC. Toque em «Começar».');
    } catch {
        clearHash();
        showToast('Este link de guião está estragado. Gere outro no PC.');
    }
}

export function initSendToPhone(onReceive: (text: string) => void): void {
    els.sendToPhoneBtn.addEventListener('click', openSendModal);
    els.closeSendToPhoneBtn.addEventListener('click', closeSendModal);
    els.sendToPhoneModal.addEventListener('click', (e) => {
        if (e.target === els.sendToPhoneModal) closeSendModal(); // toque fora do cartão
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !els.sendToPhoneModal.classList.contains('hidden')) closeSendModal();
    });
    els.copyShareLinkBtn.addEventListener('click', async () => {
        try {
            await navigator.clipboard.writeText(currentLink);
            els.copyShareLinkBtn.textContent = 'Copiado';
            setTimeout(() => { els.copyShareLinkBtn.textContent = 'Copiar link'; }, 1500);
        } catch {
            showToast('Não foi possível copiar. Use o código QR.');
        }
    });

    window.addEventListener('hashchange', () => receiveFromHash(onReceive));
    receiveFromHash(onReceive);
}
