import { state } from './state';

// Definições guardadas neste browser, para não ter de as acertar a cada gravação.
const PREFS_KEY = 'teleponto_prefs';

interface SavedPrefs {
    config?: Partial<typeof state.config>;
    languageSetting?: string;
    isMirrored?: boolean;
    isMirroredH?: boolean;
}

export function loadPrefs(): void {
    let saved: SavedPrefs = {};
    try {
        saved = JSON.parse(localStorage.getItem(PREFS_KEY) || '{}');
    } catch {
        return;
    }
    if (saved.config) {
        for (const [key, value] of Object.entries(saved.config)) {
            const k = key as keyof typeof state.config;
            // só aceita chaves que existem e com o mesmo tipo (definições antigas não estragam nada)
            if (k in state.config && typeof value === typeof state.config[k]) {
                (state.config as any)[k] = value;
            }
        }
    }
    if (typeof saved.languageSetting === 'string') {
        state.languageSetting = saved.languageSetting;
        if (saved.languageSetting !== 'auto') state.selectedLanguage = saved.languageSetting;
    }
    if (typeof saved.isMirrored === 'boolean') state.isMirrored = saved.isMirrored;
    if (typeof saved.isMirroredH === 'boolean') state.isMirroredH = saved.isMirroredH;
}

export function savePrefs(): void {
    const prefs: SavedPrefs = {
        config: state.config,
        languageSetting: state.languageSetting,
        isMirrored: state.isMirrored,
        isMirroredH: state.isMirroredH
    };
    try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    } catch {
        // modo privado ou armazenamento cheio: as definições ficam só nesta sessão
    }
}
