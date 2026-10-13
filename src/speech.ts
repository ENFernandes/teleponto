import { state } from './state';
import { els } from './elements';
import { updateMicUI, updateHighlight, scrollToCurrent, advancePastSkipped, restartScript, navigateParagraphs } from './render';
import { buildKeys, detectCommand, Follower, tokenize } from './matcher';
import { ScriptWord } from './types';

// O seguidor é refeito quando o guião muda; a posição sincroniza-se com
// state.currentIndex, que também muda por toque, recomeço ou salto de parágrafo.
let follower: Follower | null = null;
let followerWords: ScriptWord[] | null = null;
let lastReportedIndex = -1;

function getFollower(): Follower {
    if (!follower || followerWords !== state.scriptWords) {
        follower = new Follower(buildKeys(state.scriptWords), state.scriptWords.length);
        followerWords = state.scriptWords;
        lastReportedIndex = -1;
    }
    if (state.currentIndex !== lastReportedIndex) {
        follower.syncToWord(state.currentIndex);
        lastReportedIndex = state.currentIndex;
    }
    return follower;
}

let speechBlocked = false;

// Voice command arming to prevent duplicate triggers
let commandArmed = true;

// Arc / silent-fail detection
let isFirstStart = true;
let gotResultOnFirstStart = false;

function showBrowserWarning() {
    els.browserWarning.classList.remove('hidden');
}

export function initSpeech(): void {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
        // No API at all — Firefox, older browsers
        showBrowserWarning();
        return;
    }

    state.recognition = new SpeechRecognition();
    state.recognition.continuous = true;
    state.recognition.interimResults = true;
    state.recognition.lang = state.selectedLanguage;

    state.recognition.onresult = (event: any) => {
        // Mark that we got real results on first start (rules out Arc silent fail)
        if (isFirstStart) {
            gotResultOnFirstStart = true;
        }

        let transcript = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
            transcript += ' ' + event.results[i][0].transcript;
        }

        const spoken = tokenize(transcript);
        const f = getFollower();

        // --- Comandos de voz ---
        if (state.config.voiceCommandsEnabled) {
            const command = detectCommand(spoken, f.keys, f.pos);
            if (command && commandArmed) {
                commandArmed = false;
                if (command === 'start') {
                    restartScript();
                } else if (command === 'finish') {
                    state.currentIndex = Math.max(0, state.scriptWords.length - 1);
                    updateHighlight();
                    scrollToCurrent();
                } else if (command === 'next') {
                    navigateParagraphs('forward', 1);
                } else {
                    navigateParagraphs('back', 1);
                }
                return; // não ler o comando como texto do guião
            }
            if (!command) commandArmed = true;
            else return; // o mesmo comando a chegar outra vez nos resultados provisórios
        }

        // --- Seguimento: usa os resultados provisórios e finais, para reagir depressa ---
        if (f.update(spoken, state.config.lookaheadWords)) {
            state.currentIndex = f.currentWord();
            advancePastSkipped();
            lastReportedIndex = state.currentIndex;
            updateHighlight();
            scrollToCurrent();
        }
    };

    state.recognition.onerror = (e: any) => {
        console.log('error:', e.error, e.message);

        // Arc / silent-fail detection: error fires immediately on first start with no results
        if (isFirstStart && !gotResultOnFirstStart) {
            isFirstStart = false;
            if (e.error === 'not-allowed' || e.error === 'service-not-allowed' || e.error === 'audio-capture' || e.error === 'aborted') {
                // These are legitimate errors that don't mean the browser lacks support
                // 'aborted' happens on Safari iOS when the permission dialog interrupts the first recognition start
            } else {
                showBrowserWarning();
            }
            state.isListening = false;
            updateMicUI(false);
            return;
        }

        if (e.error === 'aborted') {
            speechBlocked = true;

            // Modern iPad detection
            const isIPad = navigator.userAgent.includes('iPad') || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 2);
            const isPWA = (window.navigator as any).standalone === true || window.matchMedia('(display-mode: standalone)').matches;

            if (isIPad && isPWA) {
                els.ipadPwaWarning.classList.remove('hidden');
            }

            state.isListening = false;
            updateMicUI(false);
            return;
        }
    };

    state.recognition.onend = () => {
        console.log('ended');

        // Arc / silent-fail detection: ended immediately on first start with no results and no error
        if (isFirstStart && !gotResultOnFirstStart) {
            isFirstStart = false;
            showBrowserWarning();
            state.isListening = false;
            updateMicUI(false);
            return;
        }
        isFirstStart = false;

        if (speechBlocked) return;
        if (state.isListening) {

            try {
                state.recognition.start();
            } catch (error) {
                console.error('Failed to restart speech recognition:', error);
            }
        } else {
            updateMicUI(false);
        }
    };
}

export function startListening(): void {
    if (!state.recognition) return;
    state.isListening = true;

    speechBlocked = false;
    try {
        state.recognition.start();
        updateMicUI(true);
    } catch (error) {
        console.error('Failed to start speech recognition:', error);
        state.isListening = false;
        updateMicUI(false);
    }
}

export function stopListening(): void {
    if (!state.recognition) return;
    state.isListening = false;

    try {
        state.recognition.stop();
        updateMicUI(false);
    } catch (error) {
        console.error('Failed to stop speech recognition:', error);
    }
}
