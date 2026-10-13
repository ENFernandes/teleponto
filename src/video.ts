import { state } from './state';
import { els } from './elements';
import { scrollToCurrent } from './render';

// Mirror the preview only for the front ('user') camera, like a selfie view.
// The rear camera should show a true (non-mirrored) image.
function applyCameraMirror(): void {
    els.videoPreview.style.transform =
        state.facingMode === 'user' ? 'scaleX(-1)' : 'none';
}

export function getMediaConstraints(): MediaStreamConstraints {
    // 1080p a 30 fps; com o telemóvel na vertical o Chrome entrega a imagem na vertical (9:16)
    const videoConstraints: any = {
        width: { ideal: 1920 },
        height: { ideal: 1080 },
        frameRate: { ideal: 30 }
    };
    
    if (state.selectedVideoDeviceId) {
        videoConstraints.deviceId = state.selectedVideoDeviceId;
    } else {
        videoConstraints.facingMode = state.facingMode;
    }

    // Sem o tratamento de chamadas (eco, ruído, ganho automático): no Android esse
    // tratamento abre o microfone em modo "chamada de voz", que nalguns telemóveis
    // ignora microfones externos ou dá silêncio. Para gravar vídeo, o som cru é melhor.
    const audioConstraints: any = {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
    };
    if (state.selectedAudioDeviceId) audioConstraints.deviceId = state.selectedAudioDeviceId;

    return {
        video: videoConstraints,
        audio: audioConstraints
    };
}

export async function enterVideoMode(): Promise<void> {
    try {
        // Always start on the front-facing camera unless a specific camera is chosen.
        if (!state.selectedVideoDeviceId) {
            state.facingMode = 'user';
        }
        const stream = await navigator.mediaDevices.getUserMedia(getMediaConstraints());
        state.mediaStream = stream;
        state.isVideoMode = true;
        state.videoLayoutMode = 'split';

        // Attach stream to video preview
        els.videoPreview.srcObject = stream;
        els.videoPreview.muted = true;
        applyCameraMirror();
        await els.videoPreview.play();

        // Show video UI
        els.videoContainer.classList.remove('hidden');
        els.videoControls.classList.remove('hidden');

        // Apply split layout by default
        applyVideoLayout();

        setTimeout(() => {
            scrollToCurrent();
        }, 50);

    } catch (err) {
        console.error('Failed to access camera:', err);
        alert('Não foi possível usar a câmara. Autorize a câmara e o microfone.');
    }
}

export async function flipCamera(): Promise<void> {
    if (!state.isVideoMode) return;
    // Swapping the camera mid-recording would invalidate the MediaRecorder's
    // stream, so block it while recording is in progress.
    if (state.isRecording) return;

    const previous = state.facingMode;
    state.facingMode = previous === 'user' ? 'environment' : 'user';

    // Clear custom device selection when manual flip button is pressed
    state.selectedVideoDeviceId = null;
    if (els.videoDeviceSelect) els.videoDeviceSelect.value = '';

    try {
        const stream = await navigator.mediaDevices.getUserMedia(getMediaConstraints());

        // Tear down the old stream only after the new one is acquired.
        if (state.mediaStream) {
            state.mediaStream.getTracks().forEach(track => track.stop());
        }
        state.mediaStream = stream;
        els.videoPreview.srcObject = stream;
        applyCameraMirror();
        await els.videoPreview.play();

    } catch (err) {
        // Device may not have the requested camera — revert.
        console.error('Failed to switch camera:', err);
        state.facingMode = previous;
        alert('Não foi possível trocar de câmara. Este aparelho pode ter só uma.');
    }
}

export function exitVideoMode(): void {
    // Stop recording if active
    if (state.isRecording) {
        stopRecording();
    }

    // Stop all media tracks
    if (state.mediaStream) {
        state.mediaStream.getTracks().forEach(track => track.stop());
        state.mediaStream = null;
    }

    // Reset video element
    els.videoPreview.srcObject = null;

    // Hide video UI
    els.videoContainer.classList.add('hidden');
    els.videoControls.classList.add('hidden');

    // Remove layout classes
    els.prompterContainer.classList.remove('video-mode-split', 'video-mode-overlay');

    setTimeout(() => {
        scrollToCurrent();
    }, 50);

    state.isVideoMode = false;
    state.isRecording = false;
    state.mediaRecorder = null;
    state.recordedChunks = [];

    // Update button states
    els.videoRecordBtn.classList.remove('hidden');
    els.videoStopBtn.classList.add('hidden');
    els.videoRecordingIndicator.classList.add('hidden');
    const dock = document.getElementById('mainControlsDock');
    if (dock) { dock.style.opacity = ''; }

}

export function toggleVideoLayout(): void {
    state.videoLayoutMode = state.videoLayoutMode === 'split' ? 'overlay' : 'split';
    applyVideoLayout();
    
    setTimeout(() => {
        scrollToCurrent();
    }, 50);

}

function applyVideoLayout(): void {
    els.prompterContainer.classList.remove('video-mode-split', 'video-mode-overlay');

    if (state.videoLayoutMode === 'split') {
        els.prompterContainer.classList.add('video-mode-split');
        els.videoLayoutToggleBtn.textContent = 'Sobrepor';
        els.videoLayoutToggleBtn.title = 'Texto por cima da imagem';
        els.scrollContainer.style.backgroundColor = state.config.bgColor;
    } else {
        els.prompterContainer.classList.add('video-mode-overlay');
        els.videoLayoutToggleBtn.textContent = 'Dividir';
        els.videoLayoutToggleBtn.title = 'Texto e imagem lado a lado';
        els.scrollContainer.style.backgroundColor = '';
    }
}

let countdownActive = false;

/** Contagem 3-2-1 no ecrã e depois começa a gravar. Devolve false se não gravou. */
export async function startRecordingWithCountdown(seconds = 3): Promise<boolean> {
    if (!state.mediaStream || state.isRecording || countdownActive) return false;
    countdownActive = true;
    const overlay = document.createElement('div');
    overlay.className = 'countdown-overlay';
    overlay.setAttribute('aria-live', 'assertive');
    document.body.appendChild(overlay);
    try {
        for (let n = seconds; n > 0; n--) {
            overlay.textContent = String(n);
            await new Promise(r => setTimeout(r, 1000));
            if (!state.isVideoMode) return false; // saiu do modo vídeo a meio da contagem
        }
    } finally {
        overlay.remove();
        countdownActive = false;
    }
    startRecording();
    return state.isRecording;
}

// ── Diagnóstico da gravação: nível do som, microfone usado, porque parou ──

interface RecordingInfo {
    startedAt: number;
    stoppedAt: number;
    mime: string;
    micLabel: string;
    peak: number; // 0–1, maior nível de som ouvido
    stoppedBy: 'user' | 'system';
    endedTracks: string[];
    error: string | null;
}

let info: RecordingInfo | null = null;
let trackWatch: AbortController | null = null;
let meter: { ctx: AudioContext; raf: number } | null = null;

function startLevelMeter(stream: MediaStream): void {
    const track = stream.getAudioTracks()[0];
    if (!track) return;
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    const ctx: AudioContext = new AudioContextClass();
    ctx.resume().catch(() => {});
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 512;
    ctx.createMediaStreamSource(new MediaStream([track])).connect(analyser);
    const data = new Uint8Array(analyser.fftSize);
    const loop = () => {
        analyser.getByteTimeDomainData(data);
        let peak = 0;
        for (let i = 0; i < data.length; i++) peak = Math.max(peak, Math.abs(data[i] - 128) / 128);
        if (info) info.peak = Math.max(info.peak, peak);
        els.recLevelBar.style.width = `${Math.min(100, Math.round(peak * 140))}%`;
        meter!.raf = requestAnimationFrame(loop);
    };
    meter = { ctx, raf: requestAnimationFrame(loop) };
}

function stopLevelMeter(): void {
    if (!meter) return;
    cancelAnimationFrame(meter.raf);
    meter.ctx.close().catch(() => {});
    meter = null;
    els.recLevelBar.style.width = '0%';
}

// AAC primeiro: o som Opus dentro de MP4 não toca na Galeria de muitos Android nem em todo o lado.
const MIME_TYPES = [
    'video/mp4;codecs=avc1,mp4a.40.2',
    'video/mp4;codecs=avc1,opus',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm'
];

export function startRecording(): void {
    if (!state.mediaStream) return;

    state.recordedChunks = [];
    const stream = state.mediaStream;
    const selectedMimeType = MIME_TYPES.find(mt => MediaRecorder.isTypeSupported(mt)) || '';

    try {
        state.mediaRecorder = new MediaRecorder(stream, {
            ...(selectedMimeType ? { mimeType: selectedMimeType } : {}),
            videoBitsPerSecond: 8_000_000,
            audioBitsPerSecond: 192_000
        });
    } catch (e) {
        state.mediaRecorder = new MediaRecorder(stream);
    }

    const audioTrack = stream.getAudioTracks()[0];
    info = {
        startedAt: performance.now(),
        stoppedAt: 0,
        mime: state.mediaRecorder.mimeType || selectedMimeType,
        micLabel: audioTrack ? (audioTrack.label || 'microfone sem nome') : 'nenhum',
        peak: 0,
        stoppedBy: 'system',
        endedTracks: [],
        error: null
    };
    // Se o sistema desligar a câmara ou o microfone a meio, fica registado (só nesta gravação)
    trackWatch?.abort();
    trackWatch = new AbortController();
    stream.getTracks().forEach(t => {
        t.addEventListener('ended', () => {
            const what = t.kind === 'audio' ? 'o microfone' : 'a câmara';
            if (info && !info.endedTracks.includes(what)) info.endedTracks.push(what);
        }, { signal: trackWatch!.signal });
    });

    state.mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
            state.recordedChunks.push(event.data);
        }
    };

    state.mediaRecorder.onerror = (event: any) => {
        if (info) info.error = event?.error?.name || 'erro desconhecido';
    };

    state.mediaRecorder.onstop = () => {
        if (info) info.stoppedAt = performance.now();
        trackWatch?.abort();
        trackWatch = null;
        stopLevelMeter();
        if (state.isRecording) resetRecordingUI(); // parou sem ser pelo botão
        showReview();
    };

    state.mediaRecorder.start(1000); // Collect data every second
    state.isRecording = true;
    startLevelMeter(stream);

    // Update UI
    els.videoRecordBtn.classList.add('hidden');
    els.videoStopBtn.classList.remove('hidden');
    els.videoRecordingIndicator.classList.remove('hidden');
    const dock = document.getElementById('mainControlsDock');
    if (dock) dock.style.opacity = (state.config.dockOpacity / 100).toString();
}

function resetRecordingUI(): void {
    state.isRecording = false;
    els.videoRecordBtn.classList.remove('hidden');
    els.videoStopBtn.classList.add('hidden');
    els.videoRecordingIndicator.classList.add('hidden');
    const dock = document.getElementById('mainControlsDock');
    if (dock) { dock.style.opacity = ''; }
}

export function stopRecording(): void {
    if (info) info.stoppedBy = 'user';
    if (state.mediaRecorder && state.mediaRecorder.state !== 'inactive') {
        state.mediaRecorder.stop();
    }
    resetRecordingUI();
}

// ── Rever, guardar, partilhar ──

let reviewBlob: Blob | null = null;
let reviewUrl = '';
let reviewName = '';

function formatDuration(ms: number): string {
    const s = Math.max(0, Math.round(ms / 1000));
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function describeFormat(mime: string): string {
    const container = mime.includes('mp4') ? 'MP4' : 'WebM';
    const audio = mime.includes('mp4a') ? 'AAC' : mime.includes('opus') ? 'Opus' : 'som por omissão';
    return `${container}, ${audio}`;
}

function showReview(): void {
    if (state.recordedChunks.length === 0) return;

    const actualMime = state.mediaRecorder?.mimeType || info?.mime || '';
    const isMP4 = actualMime.includes('mp4');
    reviewBlob = new Blob(state.recordedChunks, { type: isMP4 ? 'video/mp4' : 'video/webm' });
    state.recordedChunks = [];

    const now = new Date();
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}-${String(now.getSeconds()).padStart(2, '0')}`;
    reviewName = `teleponto-${timestamp}.${isMP4 ? 'mp4' : 'webm'}`;

    if (reviewUrl) URL.revokeObjectURL(reviewUrl);
    reviewUrl = URL.createObjectURL(reviewBlob);
    els.reviewVideo.src = reviewUrl;

    const duration = info ? info.stoppedAt - info.startedAt : 0;
    const sizeMb = (reviewBlob.size / 1_000_000).toFixed(1).replace('.', ',');
    const peakPct = Math.round((info?.peak ?? 0) * 100);
    els.reviewInfo.textContent =
        `${formatDuration(duration)} · ${sizeMb} MB · ${describeFormat(actualMime)} · ` +
        `Microfone: ${info?.micLabel ?? '?'} · Nível máximo do som: ${peakPct} %`;

    const warnings: string[] = [];
    if (info && info.stoppedBy === 'system') {
        const what = info.endedTracks.length ? `o sistema desligou ${info.endedTracks.join(' e ')}` : 'a gravação foi interrompida pelo sistema';
        warnings.push(`A gravação parou sozinha aos ${formatDuration(duration)}: ${what}.`);
    }
    if (info?.error) warnings.push(`Erro do gravador: ${info.error}.`);
    if (info && info.micLabel === 'nenhum') warnings.push('Não havia microfone na gravação.');
    else if (peakPct < 2) warnings.push('Não se ouviu som durante a gravação. Confirme o microfone em Definições → Microfone e grave outra vez.');
    els.reviewWarning.textContent = warnings.join(' ');
    els.reviewWarning.classList.toggle('hidden', warnings.length === 0);

    const file = new File([reviewBlob], reviewName, { type: reviewBlob.type });
    const canShare = typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
    els.reviewShareBtn.classList.toggle('hidden', !canShare);

    els.reviewModal.classList.remove('hidden');
}

function closeReview(): void {
    els.reviewModal.classList.add('hidden');
    els.reviewVideo.pause();
    els.reviewVideo.removeAttribute('src');
    els.reviewVideo.load();
    if (reviewUrl) URL.revokeObjectURL(reviewUrl);
    reviewUrl = '';
    reviewBlob = null;
}

function saveReview(): void {
    if (!reviewBlob) return;
    const url = URL.createObjectURL(reviewBlob);
    const a = document.createElement('a');
    a.href = url;
    a.download = reviewName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    closeReview();
}

async function shareReview(): Promise<void> {
    if (!reviewBlob) return;
    const file = new File([reviewBlob], reviewName, { type: reviewBlob.type });
    try {
        await navigator.share({ files: [file], title: 'Teleponto' });
        closeReview();
    } catch {
        // cancelou a partilha: fica no ecrã de revisão
    }
}

export function initRecordingReview(): void {
    els.reviewSaveBtn.addEventListener('click', saveReview);
    els.reviewShareBtn.addEventListener('click', shareReview);
    els.reviewDiscardBtn.addEventListener('click', () => {
        if (confirm('Descartar esta gravação?')) closeReview();
    });
}
