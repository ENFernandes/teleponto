import './style.css';
import { registerSW } from 'virtual:pwa-register';
import { initElements, els } from './elements';
import { state } from './state';
import { renderScript, updateHighlight, scrollToCurrent, applySettings, renderHistoryList, restartScript, navigateParagraphs } from './render';
import { loadPrefs, savePrefs } from './prefs';
import { enterPrompterScreen, leavePrompterScreen } from './screen';
import { initSpeech, startListening, stopListening } from './speech';
import { autoScrollManager } from './autoscroll';
import { saveToHistory, getHistory, clearAllHistory } from './storage';
import { ScriptWord, ScrollingMode } from './types';
import { enterVideoMode, exitVideoMode, toggleVideoLayout, startRecordingWithCountdown, stopRecording, flipCamera, getMediaConstraints } from './video';
import { detectAll } from 'tinyld/light';
import { enumerateAndPopulateDevices } from './devices';

const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

interface LangItem { id: string; name: string }

const AUTO_LANGS: LangItem[] = [
    { id: 'en-US', name: 'Inglês' },
    { id: 'es-ES', name: 'Espanhol' },
    { id: 'fr-FR', name: 'Francês' },
    { id: 'de-DE', name: 'Alemão' },
    { id: 'it-IT', name: 'Italiano' },
    { id: 'pt-PT', name: 'Português (Portugal)' },
    { id: 'pt-BR', name: 'Português (Brasil)' },
    { id: 'ru-RU', name: 'Russo' },
    { id: 'ja-JP', name: 'Japonês' },
    { id: 'zh-CN', name: 'Chinês' },
    { id: 'ko-KR', name: 'Coreano' },
    { id: 'ar-SA', name: 'Árabe' },
    { id: 'nl-NL', name: 'Neerlandês' },
    { id: 'pl-PL', name: 'Polaco' },
    { id: 'uk-UA', name: 'Ucraniano' },
    { id: 'hi-IN', name: 'Hindi' },
    { id: 'tr-TR', name: 'Turco' },
    { id: 'sv-SE', name: 'Sueco' },
    { id: 'da-DK', name: 'Dinamarquês' },
    { id: 'fi-FI', name: 'Finlandês' },
    { id: 'no-NO', name: 'Norueguês' }
].sort((a, b) => a.name.localeCompare(b.name, 'pt'));

const MANUAL_LANGS: LangItem[] = [
    { id: 'id-ID', name: 'Indonésio' },
    { id: 'ms-MY', name: 'Malaio' },
    { id: 'ca-ES', name: 'Catalão' },
    { id: 'cs-CZ', name: 'Checo' },
    { id: 'el-GR', name: 'Grego' },
    { id: 'he-IL', name: 'Hebraico' },
    { id: 'hu-HU', name: 'Húngaro' },
    { id: 'ro-RO', name: 'Romeno' },
    { id: 'sk-SK', name: 'Eslovaco' },
    { id: 'th-TH', name: 'Tailandês' },
    { id: 'vi-VN', name: 'Vietnamita' },
    { id: 'bg-BG', name: 'Búlgaro' },
    { id: 'hr-HR', name: 'Croata' },
    { id: 'sr-RS', name: 'Sérvio' },
].sort((a, b) => a.name.localeCompare(b.name, 'pt'));

const LANG_MAP: Record<string, string> = {
    'en': 'en-US', 'es': 'es-ES', 'fr': 'fr-FR', 'de': 'de-DE',
    'it': 'it-IT', 'pt': 'pt-PT', 'ru': 'ru-RU', 'ja': 'ja-JP',
    'zh': 'zh-CN', 'ko': 'ko-KR', 'ar': 'ar-SA', 'nl': 'nl-NL',
    'pl': 'pl-PL', 'uk': 'uk-UA', 'hi': 'hi-IN', 'tr': 'tr-TR',
    'sv': 'sv-SE', 'da': 'da-DK', 'fi': 'fi-FI', 'no': 'no-NO'
};

function renderLanguageDropdowns() {
    [els.languageSelectContainer, els.languageSelectSettingsContainer].forEach(container => {
        container.innerHTML = `
            <button class="w-full flex items-center justify-between text-left bg-neutral-800 border border-neutral-700 rounded px-3 h-[38px] text-sm text-neutral-300 focus:ring-2 focus:ring-[#FFBB00] focus:border-transparent outline-none transition-colors hover:bg-neutral-700 min-w-[200px]" data-dropdown-toggle>
                <div class="flex flex-col flex-1 truncate">
                    <span class="font-medium dropdown-title">Detetar</span>
                    <span class="text-[10px] text-neutral-400 dropdown-subtitle truncate h-3 mt-0.5" style="display: none;"></span>
                </div>
                <svg class="w-4 h-4 ml-2 flex-shrink-0 text-neutral-400 transition-transform duration-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7" />
                </svg>
            </button>
            <div class="absolute z-50 w-full mt-1 bg-neutral-900 border border-neutral-700 rounded-lg shadow-2xl opacity-0 scale-95 pointer-events-none transition-all duration-200 origin-top dropdown-menu overflow-hidden flex flex-col max-h-[60vh] sm:max-h-[300px]">
                <div class="overflow-y-auto no-scrollbar py-2">
                    <button class="w-full text-left px-3 py-2 hover:bg-neutral-800 transition-colors flex flex-col lang-option" data-value="auto">
                        <div class="flex items-center justify-between w-full">
                            <span class="font-medium text-white">Automática</span>
                            <span class="text-[10px] text-neutral-500 auto-detected-label ml-2 truncate"></span>
                        </div>
                    </button>
                    
                    <div class="px-3 py-1 mt-1 flex items-center justify-between">
                        <span class="text-[10px] uppercase font-bold text-neutral-500 tracking-wider">Com deteção automática</span>
                    </div>
                    
                    ${AUTO_LANGS.map(lang => `
                        <button class="w-full text-left px-3 py-1.5 hover:bg-neutral-800 transition-colors flex items-center justify-between lang-option" data-value="${lang.id}">
                            <span class="text-sm text-neutral-300">${lang.name}</span>
                            <span class="text-[9px] font-bold bg-[#FFBB00]/10 text-[#FFBB00] px-1.5 py-0.5 rounded-full tracking-wider">AUTO</span>
                        </button>
                    `).join('')}

                    <div class="px-3 py-1 mt-2 flex items-center justify-between border-t border-neutral-800 pt-2">
                        <span class="text-[10px] uppercase font-bold text-neutral-500 tracking-wider">Só escolha manual</span>
                    </div>

                    ${MANUAL_LANGS.map(lang => `
                        <button class="w-full text-left px-3 py-1.5 hover:bg-neutral-800 transition-colors flex items-center justify-between lang-option" data-value="${lang.id}">
                            <span class="text-sm text-neutral-300">${lang.name}</span>
                        </button>
                    `).join('')}
                </div>
            </div>
        `;

        const toggle = container.querySelector('[data-dropdown-toggle]') as HTMLButtonElement;
        const menu = container.querySelector('.dropdown-menu') as HTMLDivElement;
        const svg = toggle.querySelector('svg') as SVGElement;

        toggle.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const isOpen = !menu.classList.contains('opacity-0');

            // Close all
            document.querySelectorAll('.dropdown-menu').forEach(m => {
                m.classList.add('opacity-0', 'scale-95', 'pointer-events-none');
                const btn = m.previousElementSibling as HTMLButtonElement;
                if (btn) btn.querySelector('svg')?.classList.remove('rotate-180');
            });

            if (!isOpen) {
                menu.classList.remove('opacity-0', 'scale-95', 'pointer-events-none');
                svg.classList.add('rotate-180');

                // Smart positioning
                const rect = menu.getBoundingClientRect();
                if (rect.bottom > window.innerHeight) {
                    menu.style.bottom = '100%';
                    menu.style.top = 'auto';
                    menu.style.marginBottom = '0.5rem';
                } else {
                    menu.style.bottom = 'auto';
                    menu.style.top = '100%';
                    menu.style.marginBottom = '0';
                }
            }
        });

        const options = menu.querySelectorAll('.lang-option');
        options.forEach(opt => {
            opt.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const val = (opt as HTMLButtonElement).dataset.value!;
                handleLanguageChange(val);
                menu.classList.add('opacity-0', 'scale-95', 'pointer-events-none');
                svg.classList.remove('rotate-180');
            });
        });
    });

    window.addEventListener('click', () => {
        document.querySelectorAll('.dropdown-menu').forEach(menu => {
            menu.classList.add('opacity-0', 'scale-95', 'pointer-events-none');
            const btn = menu.previousElementSibling as HTMLButtonElement;
            if (btn) btn.querySelector('svg')?.classList.remove('rotate-180');
        });
    });
}

function updateAutoDetectText(detectedVal: string | null) {
    let detectedName = '';
    const allLangs = [...AUTO_LANGS, ...MANUAL_LANGS];

    if (detectedVal) {
        const found = allLangs.find(l => l.id === detectedVal);
        detectedName = found ? found.name : detectedVal;
    }

    [els.languageSelectContainer, els.languageSelectSettingsContainer].forEach(container => {
        const toggleTitle = container.querySelector('.dropdown-title') as HTMLElement;
        const toggleSub = container.querySelector('.dropdown-subtitle') as HTMLElement;
        const autoOptLabel = container.querySelector('.auto-detected-label') as HTMLElement;

        if (!toggleTitle) return;

        // Ensure subtitle is always hidden since we are using brackets in the title now
        if (toggleSub) toggleSub.style.display = 'none';

        if (state.languageSetting === 'auto') {
            if (detectedName) {
                toggleTitle.textContent = `Automática (${detectedName})`;
                if (autoOptLabel) autoOptLabel.textContent = `${detectedName} detetado`;
            } else {
                toggleTitle.textContent = 'Detetar';
                if (autoOptLabel) autoOptLabel.textContent = '';
            }
            toggleTitle.classList.add('text-white');
            toggleTitle.classList.remove('text-neutral-300');
        } else {
            const found = allLangs.find(l => l.id === state.languageSetting);
            toggleTitle.textContent = found ? found.name : state.languageSetting;
            toggleTitle.classList.remove('text-white');
            toggleTitle.classList.add('text-neutral-300');

            if (autoOptLabel) autoOptLabel.textContent = detectedName ? `${detectedName} detetado` : '';
        }
    });
}

// Declarado cedo: boot() pode chamar pinDockToVisualViewport() antes do fim do módulo.
let dockPinned = false;

// --- PWA Update Handling ---
registerSW({ immediate: true });

// --- Initialization ---
loadPrefs(); // antes de initSpeech, que lê a língua
initElements();
initSpeech();
renderLanguageDropdowns();

// --- Toast ---
let langWarningTimer: ReturnType<typeof setTimeout> | null = null;
function showLangDetectionWarning() {
    const toast = els.langDetectionWarning;
    toast.classList.remove('hidden');
    if (langWarningTimer) clearTimeout(langWarningTimer);
    langWarningTimer = setTimeout(() => toast.classList.add('hidden'), 6000);
}

// --- Main Logic ---

function loadScript(text: string): void {
    if (!text) return;
    const scriptText = text.trim();
    if (!scriptText) return;

    // Save to history (unless it's a reload of the same text, handled by storage)
    saveToHistory(scriptText);

    // Detect language and update Speech Recognition
    let targetLang = state.languageSetting;

    if (targetLang === 'auto') {
        const results = detectAll(scriptText);
        const top = results[0];
        const confidence = top?.accuracy ?? 0;
        const detection = top?.lang ?? '';
        let mappedLang = LANG_MAP[detection] || 'en-US';
        state.detectedLanguage = mappedLang;
        targetLang = mappedLang;
        updateAutoDetectText(mappedLang);
        if (confidence < 0.5) {
            showLangDetectionWarning();
        }
    } else {
        state.detectedLanguage = null;
        updateAutoDetectText(null);
    }

    state.selectedLanguage = targetLang;
    if (state.recognition) {
        state.recognition.lang = targetLang;
    }


    // Instant Update Logic:
    // If preserveFormatting is ON, we want to treat newlines as actual breaks.
    // We'll use ||BR|| for this.
    let processedText = scriptText;
    if (state.config.preserveFormatting) {
        processedText = processedText.replace(/\n/g, ' ||BR|| ');
    } else {
        processedText = processedText.replace(/\n+/g, ' ||LB|| ');
    }

    const rawWords = processedText.split(/\s+/);

    let inBracket = false;
    state.scriptWords = rawWords.map(word => {
        // Check special stop sign token
        if (word === '||LB||') {
            return {
                word: '🛑',
                clean: '',
                element: null,
                skip: true,
                isStop: true
            } as ScriptWord;
        }

        // Check special break token
        if (word === '||BR||') {
            return {
                word: '',
                clean: '',
                element: null,
                skip: true,
                isBreak: true, // Flag to mark as line break
                isStop: false
            } as ScriptWord;
        }

        // Check bracket state
        if (word.includes('[')) inBracket = true;
        const shouldSkip = inBracket || /[\u{1F300}-\u{1F9FF}]/u.test(word); // Skip brackets and emojis
        if (word.includes(']')) inBracket = false;

        // Clean word for matching
        const cleanWord = word.replace(/[^\p{L}\p{N}]/gu, "").toLowerCase();

        return {
            word: word,
            clean: cleanWord,
            element: null,
            skip: shouldSkip,
            isStop: false
        } as ScriptWord;
    });

    renderScript();
    applySettings(); // Ensure settings are applied after render
    enterPrompterScreen();
    lockBodyScroll(); // Keep tap targets aligned in the full-screen prompter (see below)
}

function resetApp(): void {
    stopListening();
    autoScrollManager.stop();
    isAutoScrollStarting = false;
    unlockBodyScroll();
    leavePrompterScreen();
    els.prompterContainer.classList.add('hidden');
    els.setupScreen.classList.remove('hidden');
    renderHistoryList(getHistory(), loadScript);
}

// ── Body scroll lock — iOS PWA landscape tap-offset fix ──────────────────
// On iOS 26 (esp. standalone/PWA, landscape) the page can get stuck in a
// negative scroll / visual-viewport offset — observed live as
// scrollY === visualViewport.offsetTop === -62. Touch coordinates are in
// visual-viewport space while element hit-testing is in layout space, so that
// offset makes every tap land ~62px from where the control is painted — both
// the dock buttons AND the script words ("I have to tap below the button").
// The teleprompter is a full-screen fixed overlay that never needs to scroll,
// so we pin the body at scroll 0 while it's open, which keeps the two
// coordinate systems aligned. Verified on-device: with this lock, scrollY and
// visualViewport.offsetTop stay 0 and taps register correctly.
let bodyScrollLocked = false;
function lockBodyScroll(): void {
    if (bodyScrollLocked) return;
    bodyScrollLocked = true;
    const b = document.body, h = document.documentElement;
    h.style.overflow = 'hidden';
    b.style.position = 'fixed';
    b.style.top = '0';
    b.style.left = '0';
    b.style.right = '0';
    b.style.bottom = '0';
    b.style.width = '100%';
    b.style.height = '100%';
    b.style.overflow = 'hidden';
    b.style.overscrollBehavior = 'none';
    window.scrollTo(0, 0);
}
function unlockBodyScroll(): void {
    if (!bodyScrollLocked) return;
    bodyScrollLocked = false;
    const b = document.body, h = document.documentElement;
    h.style.overflow = '';
    b.style.position = '';
    b.style.top = '';
    b.style.left = '';
    b.style.right = '';
    b.style.bottom = '';
    b.style.width = '';
    b.style.height = '';
    b.style.overflow = '';
    b.style.overscrollBehavior = '';
    window.scrollTo(0, 0);
}
// The stuck offset can reappear on orientation change or when iOS adjusts the
// visual viewport; re-zero the scroll whenever it drifts while locked.
function keepScrollZeroWhileLocked(): void {
    if (bodyScrollLocked && Math.round(window.scrollY) !== 0) window.scrollTo(0, 0);
}
if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', keepScrollZeroWhileLocked);
    window.visualViewport.addEventListener('scroll', keepScrollZeroWhileLocked);
}
window.addEventListener('orientationchange', () => setTimeout(keepScrollZeroWhileLocked, 60));

function clearHistory(): void {
    if (confirm('Apagar todos os guiões recentes?')) {
        clearAllHistory();
        renderHistoryList(getHistory(), loadScript);
    }
}

// --- Event Listeners ---

// Load Script Button
els.loadScriptBtn.addEventListener('click', () => {
    loadScript(els.inputScript.value);
});

// Clear Script Button
els.clearScriptBtn.addEventListener('click', () => {
    els.inputScript.value = '';
    els.inputScript.focus();
});

// Copy Script Button
els.copyScriptBtn.addEventListener('click', async () => {
    const text = els.inputScript.value;
    if (!text) return;
    try {
        await navigator.clipboard.writeText(text);
        const originalText = els.copyScriptBtn.textContent;
        els.copyScriptBtn.textContent = 'Copiado';
        setTimeout(() => els.copyScriptBtn.textContent = originalText, 1500);
    } catch (err) {
    }
});

// Paste Script Button
els.pasteScriptBtn.addEventListener('click', async () => {
    try {
        const text = await navigator.clipboard.readText();
        els.inputScript.value = text;
        els.inputScript.focus();
    } catch (err) {
        console.error('Failed to paste!', err);
    }
});

// Play / Pause / Record Button
let isAutoScrollStarting = false;

els.micButton.addEventListener('click', async () => {
    if (isAutoScrollStarting) {
        autoScrollManager.stop();
        isAutoScrollStarting = false;
        return;
    }

    if (state.isListening) {
        if (state.config.scrollingMode === 'voice') {
            stopListening();
        } else {
            autoScrollManager.stop();
            state.isListening = false;
            import('./render').then(({ updateMicUI }) => updateMicUI(false));
        }
        // Restore dock opacity
        const dock = document.getElementById('mainControlsDock');
        if (dock) dock.style.opacity = '';
    } else {
        if (state.config.scrollingMode === 'voice') {
            startListening();
        } else {
            isAutoScrollStarting = true;
            const started = await autoScrollManager.start();
            isAutoScrollStarting = false;
            if (!started) {
                if (state.config.scrollingMode === 'sound') {
                    alert('O modo de som precisa do microfone. Autorize o microfone e tente outra vez.');
                }
                return;
            }
            state.isListening = true;
            const { updateMicUI } = await import('./render');
            updateMicUI(true);
        }
        // Fade dock while listening
        const dock = document.getElementById('mainControlsDock');
        if (dock) dock.style.opacity = (state.config.dockOpacity / 100).toString();
    }
});

// Reset App Button
els.resetAppBtn.addEventListener('click', resetApp);

// Restart Script Button
els.restartScriptBtn.addEventListener('click', restartScript);

// Toggle Settings
els.toggleSettingsBtn.addEventListener('click', () => {
    const isHidden = els.settingsPanel.classList.toggle('hidden');
    if (!isHidden) {
        if (!isIOS) {
            enumerateAndPopulateDevices(false);
        }
    }
});

// Close Settings
els.closeSettingsBtn.addEventListener('click', () => {
    els.settingsPanel.classList.add('hidden');
});

// Font Size Slider
els.fontSizeInput.addEventListener('input', (e) => {
    const val = parseInt((e.target as HTMLInputElement).value);
    state.config.fontSize = val;
    els.fontSizeVal.textContent = `${val}px`;
    els.scriptContent.style.fontSize = `${val}px`;
});

// Line Height Slider
els.lineHeightInput.addEventListener('input', (e) => {
    const val = parseFloat((e.target as HTMLInputElement).value);
    state.config.lineHeight = val;
    els.lineHeightVal.textContent = `${val}x`;
    els.scriptContent.style.lineHeight = `${val}`;
});

// Paragraph Spacing Slider
els.paragraphSpacingInput.addEventListener('input', (e) => {
    const val = parseFloat((e.target as HTMLInputElement).value);
    state.config.paragraphSpacing = val;
    els.paragraphSpacingVal.textContent = `${val}em`;
    applySettings();
});

// Margin Slider
els.marginInput.addEventListener('input', (e) => {
    const val = parseInt((e.target as HTMLInputElement).value);
    state.config.margin = val;
    els.marginVal.textContent = `${val}%`;
    els.scriptContent.style.paddingLeft = `${val}%`;
    els.scriptContent.style.paddingRight = `${val}%`;
});

// Dock Opacity Slider
els.dockOpacityInput.addEventListener('input', (e) => {
    const val = parseInt((e.target as HTMLInputElement).value);
    state.config.dockOpacity = val;
    els.dockOpacityVal.textContent = `${val}%`;
    // Apply live preview if the dock is currently faded (mic listening or recording)
    if (state.isListening || state.isRecording) {
        const dock = document.getElementById('mainControlsDock');
        if (dock) dock.style.opacity = (val / 100).toString();
    }
});

// Active Line Position Slider
els.activeLinePositionInput.addEventListener('input', (e) => {
    const val = parseInt((e.target as HTMLInputElement).value);
    state.config.activeLinePosition = val;
    els.activeLinePositionVal.textContent = `${val}%`;

    // Update spacer to allow scrolling to the bottom-most position
    // If position is 90% (bottom), we need less spacer at top but more at bottom?
    // Actually, scrollToCurrent handles the positioning logic.
    // We just need to trigger a scroll update.
    scrollToCurrent();
});

// Lookahead Words Slider
els.lookaheadWordsInput.addEventListener('input', (e) => {
    const val = parseInt((e.target as HTMLInputElement).value);
    state.config.lookaheadWords = val;
    els.lookaheadWordsVal.textContent = `${val}`;
});

// Text Color Picker
els.textColorInput.addEventListener('input', (e) => {
    state.config.textColor = (e.target as HTMLInputElement).value;
    applySettings();
});

// Background Color Picker
els.bgColorInput.addEventListener('input', (e) => {
    state.config.bgColor = (e.target as HTMLInputElement).value;
    applySettings();
});

// Alignment Buttons
(['left', 'center', 'right'] as const).forEach(align => {
    els.alignBtns[align].addEventListener('click', () => {
        state.config.textAlign = align;
        els.scriptContent.style.textAlign = align;
        updateAlignmentButtons();
    });
});

// Text Direction Buttons
(['ltr', 'rtl'] as const).forEach(dir => {
    els.dirBtns[dir].addEventListener('click', () => {
        state.config.textDirection = dir as 'ltr' | 'rtl';
        applySettings();
        updateDirectionButtons();
    });
});

// Theme Presets
els.themeDarkBtn.addEventListener('click', () => {
    state.config.bgColor = '#000000';
    state.config.textColor = '#ffffff';
    els.bgColorInput.value = '#000000';
    els.textColorInput.value = '#ffffff';
    applySettings();
});

els.themeLightBtn.addEventListener('click', () => {
    state.config.bgColor = '#ffffff';
    state.config.textColor = '#000000';
    els.bgColorInput.value = '#ffffff';
    els.textColorInput.value = '#000000';
    applySettings();
});

// Mirror Toggle
els.mirrorToggle.addEventListener('change', (e) => {
    state.isMirrored = (e.target as HTMLInputElement).checked;

    if (state.isMirrored) {
        els.scrollContainer.classList.add('mirror-mode');
    } else {
        els.scrollContainer.classList.remove('mirror-mode');
    }
});

// Horizontal Mirror Toggle (beta, revealed via ?beta=hmirror)
els.hMirrorToggle.addEventListener('change', (e) => {
    state.isMirroredH = (e.target as HTMLInputElement).checked;

    if (state.isMirroredH) {
        els.scrollContainer.classList.add('mirror-mode-h');
    } else {
        els.scrollContainer.classList.remove('mirror-mode-h');
    }
});

// Fullscreen Toggle
els.fullscreenToggle.addEventListener('change', (e) => {
    state.config.fullscreenOnStart = (e.target as HTMLInputElement).checked;
});

// Stop Sign Toggle
els.stopSignToggle.addEventListener('change', (e) => {
    state.config.showStopIcon = (e.target as HTMLInputElement).checked;
    if (state.config.showStopIcon) {
        els.scriptContent.classList.add('show-stops');
    } else {
        els.scriptContent.classList.remove('show-stops');
    }
});

function handleLanguageChange(lang: string) {
    state.languageSetting = lang;

    // if auto, re-detect if there is a script
    if (lang === 'auto') {
        if (els.inputScript.value.trim()) {
            const results = detectAll(els.inputScript.value.trim());
            const top = results[0];
            const confidence = top?.accuracy ?? 0;
            const detection = top?.lang ?? '';
            const mappedLang = LANG_MAP[detection] || 'en-US';
            state.detectedLanguage = mappedLang;
            state.selectedLanguage = mappedLang;
            updateAutoDetectText(mappedLang);
            if (confidence < 0.5) {
                showLangDetectionWarning();
            }
        } else {
            state.selectedLanguage = 'en-US'; // fallback empty script
            updateAutoDetectText(null);
        }
    } else {
        state.selectedLanguage = lang;
        state.detectedLanguage = null;
        updateAutoDetectText(null);
    }

    if (state.recognition) {
        state.recognition.lang = state.selectedLanguage;
    }
    savePrefs();
}

// Preserve Formatting Toggle
els.preserveFormattingToggle.addEventListener('change', (e) => {
    state.config.preserveFormatting = (e.target as HTMLInputElement).checked;

    // Instant update if we have text
    const text = els.inputScript.value.trim();
    if (text) {
        // Save current index to try and restore position
        const currentIndex = state.currentIndex;

        loadScript(text);

        // Restore position (approximate)
        if (currentIndex < state.scriptWords.length) {
            state.currentIndex = currentIndex;
            updateHighlight();
            scrollToCurrent();
        }
    }
});

// Voice Command Toggle
els.voiceCommandToggle.addEventListener('change', (e) => {
    state.config.voiceCommandsEnabled = (e.target as HTMLInputElement).checked;
});

// Screen Rotation Toggle
els.screenRotationToggle.addEventListener('change', (e) => {
    state.isScreenRotated = (e.target as HTMLInputElement).checked;

    if (state.isScreenRotated) {
        document.body.classList.add('screen-rotated');
    } else {
        document.body.classList.remove('screen-rotated');
    }
    // Re-evaluate the dock: in rotated mode it must drop the viewport-based
    // pin and use the CSS `bottom-8`; on un-rotate it must re-pin.
    pinDockToVisualViewport();
});

// Smooth Animations Toggle
els.smoothAnimationsToggle.addEventListener('change', (e) => {
    state.config.smoothAnimations = (e.target as HTMLInputElement).checked;
    applySettings();
});

// Highlight Active Word Toggle
els.highlightActiveWordToggle.addEventListener('change', (e) => {
    state.config.highlightActiveWord = (e.target as HTMLInputElement).checked;
    applySettings();
    updateHighlight();
});

// Font Family Buttons
(['mono', 'sans', 'serif', 'comicSans'] as const).forEach(font => {
    els.fontFamilyBtns[font].addEventListener('click', () => {
        state.config.fontFamily = font;
        applySettings();
        updateFontFamilyButtons();
    });
});

// Clear History Button
els.clearHistoryBtn.addEventListener('click', clearHistory);

// Dismiss Browser Warning
els.dismissWarningBtn.addEventListener('click', () => {
    els.browserWarning.classList.add('hidden');
});

// Dismiss iPad PWA Warning
els.dismissIpadWarningBtn.addEventListener('click', () => {
    els.ipadPwaWarning.classList.add('hidden');
});

// Dismiss Language Detection Warning
els.dismissLangWarningBtn.addEventListener('click', () => {
    els.langDetectionWarning.classList.add('hidden');
    if (langWarningTimer) clearTimeout(langWarningTimer);
});

// Dismiss Android Video Warning
els.dismissAndroidVideoWarningBtn.addEventListener('click', () => {
    els.androidVideoWarning.classList.add('hidden');
});

// --- Video Mode Event Listeners ---

const isAndroid = /Android/i.test(navigator.userAgent);
// No Android a voz e a gravação não partilham o microfone: a gravar, passa ao modo de som
// (que usa o microfone do vídeo) e volta ao modo anterior ao sair.
let modeBeforeVideo: ScrollingMode | null = null;
let androidWarningShown = false;

function stopFollowing(): void {
    if (state.isListening) els.micButton.click();
}

// Toggle Video Mode
els.videoModeBtn.addEventListener('click', async () => {
    if (state.isVideoMode) {
        stopFollowing(); // o modo de som pode estar a usar o microfone do vídeo
        exitVideoMode();
        if (modeBeforeVideo) {
            state.config.scrollingMode = modeBeforeVideo;
            modeBeforeVideo = null;
            updateScrollingUI();
            savePrefs();
        }
    } else {
        const switchToSound = isAndroid && state.config.scrollingMode === 'voice';
        if (switchToSound) stopFollowing();
        const originalContent = els.videoModeBtn.innerHTML;
        (els.videoModeBtn as HTMLButtonElement).disabled = true;
        els.videoModeBtn.innerHTML = `<svg class="animate-spin h-6 w-6 text-neutral-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>`;
        
        await enterVideoMode();

        (els.videoModeBtn as HTMLButtonElement).disabled = false;
        els.videoModeBtn.innerHTML = originalContent;

        if (state.isVideoMode && switchToSound) {
            modeBeforeVideo = 'voice';
            state.config.scrollingMode = 'sound';
            updateScrollingUI();
            if (!androidWarningShown) {
                els.androidVideoWarning.classList.remove('hidden');
                androidWarningShown = true;
            }
        }
    }
});

// Toggle Video Layout
els.videoLayoutToggleBtn.addEventListener('click', toggleVideoLayout);

// Flip Camera (front <-> rear)
els.videoFlipCameraBtn.addEventListener('click', flipCamera);

// Gravar: contagem 3-2-1, depois grava e o texto começa a avançar
els.videoRecordBtn.addEventListener('click', async () => {
    const started = await startRecordingWithCountdown();
    if (started && !state.isListening) els.micButton.click();
});

// Parar a gravação também pára o texto
els.videoStopBtn.addEventListener('click', () => {
    stopRecording();
    stopFollowing();
});

// --- Initialization ---
function initializeUI(): void {
    // Hidden beta flag: visiting with ?beta=hmirror persistently unlocks the
    // horizontal mirror toggle on this device (and relabels the vertical one).
    if (new URLSearchParams(window.location.search).get('beta') === 'hmirror') {
        localStorage.setItem('beta-hmirror', '1');
    }
    if (localStorage.getItem('beta-hmirror') === '1') {
        els.hMirrorRow.classList.remove('hidden');
        els.hMirrorRow.classList.add('flex');
        els.mirrorModeLabel.textContent = 'Espelho vertical';
    }

    // Set UI values from state
    els.fontSizeVal.textContent = `${state.config.fontSize}px`;
    els.fontSizeInput.value = state.config.fontSize.toString();

    els.lineHeightVal.textContent = `${state.config.lineHeight}x`;
    els.lineHeightInput.value = state.config.lineHeight.toString();
    els.scriptContent.style.lineHeight = `${state.config.lineHeight}`;

    els.paragraphSpacingVal.textContent = `${state.config.paragraphSpacing}em`;
    els.paragraphSpacingInput.value = state.config.paragraphSpacing.toString();

    els.marginVal.textContent = `${state.config.margin}%`;
    els.marginInput.value = state.config.margin.toString();

    els.dockOpacityVal.textContent = `${state.config.dockOpacity}%`;
    els.dockOpacityInput.value = state.config.dockOpacity.toString();

    els.activeLinePositionVal.textContent = `${state.config.activeLinePosition}%`;
    els.activeLinePositionInput.value = state.config.activeLinePosition.toString();

    els.lookaheadWordsVal.textContent = `${state.config.lookaheadWords}`;
    els.lookaheadWordsInput.value = state.config.lookaheadWords.toString();

    // Interruptores e cores a partir das definições guardadas
    els.mirrorToggle.checked = state.isMirrored;
    els.scrollContainer.classList.toggle('mirror-mode', state.isMirrored);
    els.hMirrorToggle.checked = state.isMirroredH;
    els.scrollContainer.classList.toggle('mirror-mode-h', state.isMirroredH);
    els.stopSignToggle.checked = state.config.showStopIcon;
    els.scriptContent.classList.toggle('show-stops', state.config.showStopIcon);
    els.voiceCommandToggle.checked = state.config.voiceCommandsEnabled;
    els.preserveFormattingToggle.checked = state.config.preserveFormatting;
    els.fullscreenToggle.checked = state.config.fullscreenOnStart;
    els.textColorInput.value = state.config.textColor;
    els.bgColorInput.value = state.config.bgColor;

    // Update alignment and direction buttons
    updateAlignmentButtons();
    updateDirectionButtons();

    els.smoothAnimationsToggle.checked = state.config.smoothAnimations;
    els.highlightActiveWordToggle.checked = state.config.highlightActiveWord;

    // Seed demo script for first-time users
    const history = getHistory();
    if (history.length === 0) {
        const demoText = `Bem-vindo ao Teleponto.\nLeia este texto em voz alta: a palavra realçada mostra onde vai, e o texto avança consigo.\nSe se enganar e repetir uma frase, o texto volta atrás.\nToque numa palavra para saltar para lá.\nO botão da câmara grava o vídeo nesta mesma página, com uma contagem de 3 segundos.\nO texto entre parênteses retos não se lê [como este]. Serve para notas.\nNas definições muda o tamanho da letra, a altura da linha de leitura e o espelho. Ficam guardadas.\nCom um comando Bluetooth ou com o teclado: setas para mudar de parágrafo, espaço para pausar.`;

        // Save to localStorage with 'demo' tag
        const demoItem = {
            id: Date.now(),
            text: demoText,
            preview: demoText.substring(0, 40) + '...',
            date: new Date().toLocaleDateString(),
            tag: 'exemplo'
        };
        localStorage.setItem('teleprompter_history', JSON.stringify([demoItem]));

        // Prefill textarea
        els.inputScript.value = demoText;

        // Re-render history with the demo item
        renderHistoryList(getHistory(), loadScript);
    } else {
        // Abre com o último guião, pronto a ler
        if (!els.inputScript.value) els.inputScript.value = history[0].text;
        renderHistoryList(history, loadScript);
    }

    updateAutoDetectText(null);

    // Apply all settings to DOM
    applySettings();
    updateFontFamilyButtons();
    if (isIOS) {
        if (els.devicesSelectionContainer) {
            els.devicesSelectionContainer.classList.add('hidden');
        }
    } else {
        enumerateAndPopulateDevices(false);
    }
}

function updateAlignmentButtons(): void {
    (['left', 'center', 'right'] as const).forEach(a => {
        const btn = els.alignBtns[a];
        const isActive = a === state.config.textAlign;
        btn.classList.toggle('bg-neutral-500', isActive);
        btn.classList.toggle('text-white', isActive);
        btn.classList.toggle('hover:bg-neutral-600', !isActive);
    });
}

function updateDirectionButtons(): void {
    (['ltr', 'rtl'] as const).forEach(dir => {
        const btn = els.dirBtns[dir];
        const isActive = state.config.textDirection === dir;
        btn.classList.toggle('bg-neutral-700', isActive);
        btn.classList.toggle('text-white', isActive);
        btn.classList.toggle('border-[#FFBB00]', isActive);
        btn.classList.toggle('bg-neutral-800', !isActive);
        btn.classList.toggle('text-neutral-300', !isActive);
        btn.classList.toggle('border-neutral-700', !isActive);
    });
}

function updateFontFamilyButtons(): void {
    (['mono', 'sans', 'serif', 'comicSans'] as const).forEach(font => {
        const btn = els.fontFamilyBtns[font];
        const isActive = state.config.fontFamily === font;
        btn.classList.toggle('bg-neutral-700', isActive);
        btn.classList.toggle('text-white', isActive);
        btn.classList.toggle('border-[#FFBB00]', isActive);
        btn.classList.toggle('bg-neutral-800', !isActive);
        btn.classList.toggle('text-neutral-300', !isActive);
        btn.classList.toggle('border-neutral-700', !isActive);
    });
}

async function handleDeviceChange(): Promise<void> {
    state.selectedVideoDeviceId = els.videoDeviceSelect.value || null;
    state.selectedAudioDeviceId = els.audioDeviceSelect.value || null;

    // If video mode is active and not recording, seamlessly switch devices
    if (state.isVideoMode && !state.isRecording) {
        try {
            const stream = await navigator.mediaDevices.getUserMedia(getMediaConstraints());
            if (state.mediaStream) {
                state.mediaStream.getTracks().forEach(track => track.stop());
            }
            state.mediaStream = stream;
            els.videoPreview.srcObject = stream;
            els.videoPreview.muted = true;
            
            // Use same mirroring rule (mirror front camera selfie mode)
            els.videoPreview.style.transform = state.selectedVideoDeviceId ? 'none' : (state.facingMode === 'user' ? 'scaleX(-1)' : 'none');
            await els.videoPreview.play();
        } catch (err) {
            console.error('Failed to switch media device sources:', err);
            alert('Não foi possível mudar para o dispositivo escolhido.');
        }
    }

    // Apply microphone changes to whichever microphone-driven mode is active.
    if (state.isListening) {
        if (state.config.scrollingMode === 'sound') {
            autoScrollManager.stop();
            const started = await autoScrollManager.start();
            if (!started) {
                state.isListening = false;
                const { updateMicUI } = await import('./render');
                updateMicUI(false);
            }
        } else if (state.config.scrollingMode === 'voice') {
            stopListening();
            setTimeout(() => {
                startListening();
            }, 400);
        }
    }
}

if (!isIOS) {
    els.videoDeviceSelect.addEventListener('change', handleDeviceChange);
    els.audioDeviceSelect.addEventListener('change', handleDeviceChange);
}

const permissionRequested = { video: false, audio: false };

async function requestPermissionsOnSelectFocus(kind: 'video' | 'audio') {
    if (permissionRequested[kind]) return;
    
    // Check if we already have device labels for this kind
    const devices = await navigator.mediaDevices.enumerateDevices();
    const needsPermission = devices.some(d => {
        if (kind === 'video' && d.kind === 'videoinput' && !d.label) return true;
        if (kind === 'audio' && d.kind === 'audioinput' && !d.label) return true;
        return false;
    });
    
    if (needsPermission) {
        permissionRequested[kind] = true;
        // Trigger permissions dialog and re-populate for this device kind
        await enumerateAndPopulateDevices(true, kind);
    }
}

if (!isIOS) {
    els.videoDeviceSelect.addEventListener('focus', () => requestPermissionsOnSelectFocus('video'));
    els.audioDeviceSelect.addEventListener('focus', () => requestPermissionsOnSelectFocus('audio'));
    els.videoDeviceSelect.addEventListener('mousedown', () => requestPermissionsOnSelectFocus('video'));
    els.audioDeviceSelect.addEventListener('mousedown', () => requestPermissionsOnSelectFocus('audio'));

    // Listen for browser device changes
    navigator.mediaDevices.addEventListener('devicechange', () => {
        enumerateAndPopulateDevices(false);
    });
}

function updateScrollingUI() {
    els.scrollingModeSelect.value = state.config.scrollingMode;
    els.scrollSpeedInput.value = state.config.scrollSpeed.toString();
    els.scrollSpeedVal.textContent = `${state.config.scrollSpeed.toFixed(1)} pal/s`;
    els.soundSensitivityInput.value = state.config.soundSensitivity.toString();
    els.soundSensitivityVal.textContent = `${Math.round(state.config.soundSensitivity * 100)}%`;

    els.scrollSpeedContainer.classList.toggle('hidden', state.config.scrollingMode === 'voice');
    els.soundSensitivityContainer.classList.toggle('hidden', state.config.scrollingMode !== 'sound');

    const descriptions: Record<ScrollingMode, string> = {
        voice: 'Segue as palavras que diz e pára quando pára.',
        sound: 'Rola enquanto o microfone ouve som e pára no silêncio. Funciona a gravar no Android.',
        constant: 'Rola sempre à velocidade escolhida.'
    };
    els.scrollingModeDescription.textContent = descriptions[state.config.scrollingMode];

    // Update Mic button icon based on mode
    const path = els.micButton.querySelector('path');
    if (path) {
        if (state.config.scrollingMode === 'voice') {
            path.setAttribute('d', 'M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm5.91-3c-.49 0-.9.36-.98.85C16.52 14.2 14.47 16 12 16s-4.52-1.8-4.93-4.15c-.08-.49-.49-.85-.98-.85-.61 0-1.09.54-1 1.14.49 3 2.89 5.35 5.91 5.78V20c0 .55.45 1 1 1s1-.45 1-1v-2.08c3.02-.43 5.42-2.78 5.91-5.78.1-.6-.39-1.14-1-1.14z');
        } else {
            // Play icon
            path.setAttribute('d', 'M8 5v14l11-7z');
        }
    }
}

els.scrollingModeSelect.addEventListener('change', (e) => {
    state.config.scrollingMode = (e.target as HTMLSelectElement).value as ScrollingMode;
    autoScrollManager.stop();
    isAutoScrollStarting = false;
    updateScrollingUI();
    if (state.isListening) {
        // Stop current mode
        stopListening();
        autoScrollManager.stop();
        state.isListening = false;
        import('./render').then(({ updateMicUI }) => updateMicUI(false));
    }
});

els.scrollSpeedInput.addEventListener('input', (e) => {
    state.config.scrollSpeed = parseFloat((e.target as HTMLInputElement).value);
    els.scrollSpeedVal.textContent = `${state.config.scrollSpeed.toFixed(1)} pal/s`;
});

els.soundSensitivityInput.addEventListener('input', (e) => {
    state.config.soundSensitivity = parseFloat((e.target as HTMLInputElement).value);
    els.soundSensitivityVal.textContent = `${Math.round(state.config.soundSensitivity * 100)}%`;
});

// Guardar as definições sempre que se mexe no painel (depois de o controlo atualizar o estado)
['input', 'change', 'click'].forEach(type => {
    els.settingsPanel.addEventListener(type, () => setTimeout(savePrefs, 0));
});

// Teclado e comando Bluetooth (os clickers de apresentações enviam setas ou Page Up/Down)
document.addEventListener('keydown', (e) => {
    if (els.prompterContainer.classList.contains('hidden')) return;
    const target = e.target as HTMLElement | null;
    if (target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName)) return;
    switch (e.key) {
        case 'ArrowDown': case 'ArrowRight': case 'PageDown':
            navigateParagraphs('forward', 1);
            break;
        case 'ArrowUp': case 'ArrowLeft': case 'PageUp':
            navigateParagraphs('back', 1);
            break;
        case ' ': case 'Enter': case 'b': case 'B': case '.':
            els.micButton.click();
            break;
        case 'Home':
            restartScript();
            break;
        case 'Escape':
            if (els.settingsPanel.classList.contains('hidden')) return;
            els.settingsPanel.classList.add('hidden');
            break;
        default:
            return;
    }
    e.preventDefault();
});

function boot(): void {
    updateScrollingUI();
    initializeUI();
    pinDockToVisualViewport();

    // Fallback for async localStorage injection (e.g. WKWebView)
    setTimeout(() => {
        renderHistoryList(getHistory(), loadScript);
    }, 500);
}

// Run boot as soon as the DOM is ready. We must NOT rely solely on the
// DOMContentLoaded event: this is an ES module (deferred), so by the time it
// evaluates the DOM is already parsed and the event may have *already fired*
// (or won't fire on a bfcache restore). When that happened, initializeUI never
// ran and the Recent Scripts list stayed empty until a later user action
// (e.g. returning from the prompter) re-rendered it.
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot, { once: true });
} else {
    boot();
}

// iOS Safari restores pages from the back-forward cache without firing
// DOMContentLoaded, so re-render history (and re-pin the dock) on show.
window.addEventListener('pageshow', () => {
    renderHistoryList(getHistory(), loadScript);
    pinDockToVisualViewport();
});

// Pin the floating controls dock to the visual viewport. iOS Safari (esp. in
// landscape) paints `position: fixed` elements near the visual viewport's
// bottom but hit-tests them at their layout-viewport position — so taps fall
// through to the script. Computing `top` from `visualViewport` keeps the hit
// rect under the rendered button.
//
// Idempotent: called from both module-eval and DOMContentLoaded so the dock is
// pinned regardless of which fires first (with async module loading either can
// win). A guard flag ensures listeners/observers are only wired once.
function pinDockToVisualViewport(): void {
    const dock = document.getElementById('mainControlsDock');
    const vv = window.visualViewport;
    if (!dock || !vv) return;
    const update = () => {
        // Manual rotation (the Screen Rotation toggle) puts a `transform` on
        // <body>, which makes `position: fixed` resolve against the rotated
        // body instead of the viewport. Our viewport-based `top` would then
        // shove the dock off-screen (buttons invisible AND untappable). Fall
        // back to the CSS `bottom-8`, which lays out correctly under rotation.
        if (document.body.classList.contains('screen-rotated')) {
            dock.style.top = '';
            dock.style.bottom = '';
            return;
        }
        // The dock starts hidden inside #prompterContainer, so offsetHeight is
        // 0 until the prompter is shown. Skip until it has a real height,
        // otherwise we'd pin it ~64px too low; the MutationObserver below
        // re-runs this once the prompter becomes visible.
        if (dock.offsetHeight === 0) return;
        const visualBottomInLayout = vv.offsetTop + vv.height;
        const margin = 32; // matches original `bottom-8`
        dock.style.bottom = 'auto';
        dock.style.top = `${visualBottomInLayout - dock.offsetHeight - margin}px`;
    };
    if (dockPinned) {
        // Already wired; just recompute (e.g. second call after DOM is ready).
        requestAnimationFrame(update);
        return;
    }
    dockPinned = true;
    vv.addEventListener('resize', update);
    vv.addEventListener('scroll', update);
    // After an orientation change iOS reports stale visualViewport dimensions
    // for a beat, so recompute on the next frame *and* after a short delay.
    window.addEventListener('orientationchange', () => {
        requestAnimationFrame(update);
        setTimeout(update, 300);
    });
    requestAnimationFrame(update);

    // Recalculate when the prompter container is shown (class 'hidden' is removed)
    const prompterContainer = document.getElementById('prompterContainer');
    if (prompterContainer) {
        const observer = new MutationObserver((mutations) => {
            for (const mutation of mutations) {
                if (mutation.attributeName === 'class') {
                    const target = mutation.target as HTMLElement;
                    if (!target.classList.contains('hidden')) {
                        // Let the DOM update first, then recalculate
                        requestAnimationFrame(update);
                    }
                }
            }
        });
        observer.observe(prompterContainer, { attributes: true, attributeFilter: ['class'] });
    }
}
pinDockToVisualViewport();
