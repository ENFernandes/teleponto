import { state } from './state';

// Ecrã sempre aceso e ecrã inteiro enquanto o teleponto está aberto.

let wakeLock: any = null;
let wantWakeLock = false;

async function requestWakeLock(): Promise<void> {
    const nav = navigator as any;
    if (!nav.wakeLock || wakeLock) return;
    try {
        wakeLock = await nav.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => { wakeLock = null; });
    } catch (err) {
        console.warn('Não foi possível manter o ecrã aceso:', err);
    }
}

// O browser larga o wake lock quando a página fica escondida; volta a pedi-lo ao regressar.
document.addEventListener('visibilitychange', () => {
    if (wantWakeLock && document.visibilityState === 'visible') requestWakeLock();
});

/** Chamar a partir de um toque do utilizador (o ecrã inteiro exige-o). */
export function enterPrompterScreen(): void {
    wantWakeLock = true;
    requestWakeLock();
    const el = document.documentElement as any;
    if (state.config.fullscreenOnStart && !document.fullscreenElement && el.requestFullscreen) {
        el.requestFullscreen({ navigationUI: 'hide' }).catch(() => { /* sem ecrã inteiro: segue normal */ });
    }
}

export function leavePrompterScreen(): void {
    wantWakeLock = false;
    if (wakeLock) {
        wakeLock.release().catch(() => {});
        wakeLock = null;
    }
    if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
    }
}
