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

    const audioConstraints: any = state.selectedAudioDeviceId
        ? { deviceId: state.selectedAudioDeviceId }
        : true;

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

export function startRecording(): void {
    if (!state.mediaStream) return;

    state.recordedChunks = [];

    // Prefer MP4 with H.264 (supported in Chrome 120+, Safari)
    // Fall back to WebM if MP4 is not available
    const mimeTypes = [
        'video/mp4;codecs=avc1,opus',
        'video/mp4;codecs=avc1',
        'video/mp4',
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm'
    ];

    let selectedMimeType = '';
    for (const mt of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mt)) {
            selectedMimeType = mt;
            break;
        }
    }

    try {
        state.mediaRecorder = selectedMimeType
            ? new MediaRecorder(state.mediaStream, { mimeType: selectedMimeType, videoBitsPerSecond: 8_000_000 })
            : new MediaRecorder(state.mediaStream);
    } catch (e) {
        state.mediaRecorder = new MediaRecorder(state.mediaStream);
    }

    state.mediaRecorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
            state.recordedChunks.push(event.data);
        }
    };

    state.mediaRecorder.onstop = () => {
        downloadRecording();
    };

    state.mediaRecorder.start(1000); // Collect data every second
    state.isRecording = true;

    // Update UI
    els.videoRecordBtn.classList.add('hidden');
    els.videoStopBtn.classList.remove('hidden');
    els.videoRecordingIndicator.classList.remove('hidden');
    const dock = document.getElementById('mainControlsDock');
    if (dock) dock.style.opacity = (state.config.dockOpacity / 100).toString();

}

export function stopRecording(): void {
    if (state.mediaRecorder && state.mediaRecorder.state !== 'inactive') {
        state.mediaRecorder.stop();
    }
    state.isRecording = false;

    // Update UI
    els.videoRecordBtn.classList.remove('hidden');
    els.videoStopBtn.classList.add('hidden');
    els.videoRecordingIndicator.classList.add('hidden');
    const dock = document.getElementById('mainControlsDock');
    if (dock) { dock.style.opacity = ''; }

}

function downloadRecording(): void {
    if (state.recordedChunks.length === 0) return;

    // Determine file extension from the actual mimeType used
    const actualMime = state.mediaRecorder?.mimeType || '';
    const isMP4 = actualMime.includes('mp4');
    const extension = isMP4 ? 'mp4' : 'webm';
    const blobType = isMP4 ? 'video/mp4' : 'video/webm';

    const blob = new Blob(state.recordedChunks, { type: blobType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');

    const now = new Date();
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}_${String(now.getHours()).padStart(2, '0')}-${String(now.getMinutes()).padStart(2, '0')}`;
    a.download = `teleponto-${timestamp}.${extension}`;

    a.href = url;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    // Cleanup
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    state.recordedChunks = [];
}
