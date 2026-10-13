import { AppState } from './types';

export const state: AppState = {
    scriptWords: [],
    currentIndex: 0,
    recognition: null,
    isListening: false,
    isMirrored: false,
    isMirroredH: false,
    isScreenRotated: false,
    selectedLanguage: 'pt-PT', // Target language for SpeechRecognition
    languageSetting: 'pt-PT', // User's dropdown preference
    detectedLanguage: null,
    config: {
        fontSize: 48,
        lineHeight: 1.0,
        margin: 0,
        textColor: '#ffffff',
        bgColor: '#000000',
        textAlign: 'left',
        textDirection: 'ltr',
        showStopIcon: false,
        preserveFormatting: true,
        voiceCommandsEnabled: false,
        paragraphSpacing: 0.5,
        smoothAnimations: false,
        highlightActiveWord: true,
        activeLinePosition: 20, // perto do topo, junto à câmara frontal
        lookaheadWords: 5, // Default lookahead
        dockOpacity: 50, // Default dock opacity (50%)
        fontFamily: 'sans', // Default font
        scrollingMode: 'voice',
        scrollSpeed: 3.5,
        soundSensitivity: 0.75,
        fullscreenOnStart: true
    },
    // Video recording state
    isVideoMode: false,
    videoLayoutMode: 'split',
    facingMode: 'user',
    isRecording: false,
    mediaRecorder: null,
    mediaStream: null,
    recordedChunks: [],
    selectedVideoDeviceId: null,
    selectedAudioDeviceId: null
};
