"""Generate four original instrumental loops using synthesis only. Requires numpy and ffmpeg."""
from pathlib import Path
import subprocess, tempfile, wave
import numpy as np

RATE = 22050
OUT = Path(__file__).resolve().parents[1] / 'public/audio'
# Different modes, tempos, instrument envelopes and rhythm patterns make each
# chapter a distinct piece, while every piece closes on its downbeat.
TRACKS = [
    ('first-whistle', 108, [55, 48, 53, 50], [0, 3, 7, 10], [0, 7, 10, 12, 15, 12, 10, 7], 'pluck'),
    ('touchline-dreams', 84, [45, 41, 48, 43], [0, 3, 7, 12], [12, 10, 7, 3, 5, 7, 3, 0], 'glass'),
    ('rising-stands', 120, [50, 46, 53, 48], [0, 4, 7, 11], [0, 4, 7, 11, 12, 11, 7, 4], 'brass'),
    ('last-light', 92, [57, 53, 48, 55], [0, 3, 7, 10], [7, 5, 3, 0, 3, 5, 7, 10], 'soft'),
]
def freq(midi): return 440 * 2 ** ((midi - 69) / 12)
for index, (name, bpm, roots, chord, melody, voice) in enumerate(TRACKS):
    beat = 60 / bpm
    length = int(16 * 4 * beat * RATE)
    mix = np.zeros(length, dtype=np.float32)
    rng = np.random.default_rng(2901 + index)
    def note(at, duration, hz, gain, timbre):
        begin = int(at * RATE)
        n = min(int(duration * RATE), length - begin)
        if n <= 0: return
        t = np.arange(n, dtype=np.float32) / RATE
        env = np.minimum(1, t / .018) * np.minimum(1, (duration - t) / .12)
        if timbre == 'pluck': env *= np.exp(-t * 4)
        if timbre == 'glass': env *= np.exp(-t * 2)
        signal = np.sin(2*np.pi*hz*t)
        if timbre in ('brass', 'pluck'): signal += .25*np.sin(4*np.pi*hz*t)
        if timbre == 'glass': signal += .26*np.sin(2*np.pi*hz*2.01*t)
        mix[begin:begin+n] += signal * env * gain
    def drum(at, kind, gain):
        begin = int(at*RATE)
        n = min(int(.20*RATE), length-begin)
        if n <= 0: return
        t = np.arange(n)/RATE
        if kind == 'kick': sample = np.sin(2*np.pi*(55*t+2*np.exp(-t*35))) * np.exp(-t*25)
        else: sample = rng.standard_normal(n) * np.exp(-t*(75 if kind=='hat' else 30))
        mix[begin:begin+n] += sample * gain
    for bar in range(16):
        start = bar*4*beat
        root = roots[bar%4]
        for offset in chord:
            note(start, 4*beat, freq(root+12+offset), .018, 'soft')
        for step in range(4):
            at = start+step*beat
            note(at, beat*.75, freq(root+(12 if step==3 else 0)), .08, 'pluck')
            drum(at, 'kick', .13 if step in (0,2) else .045)
            if step in (1,3): drum(at, 'snare', .027 if index==1 else .045)
            if index != 1 or step%2 == 0: drum(at+beat*.5, 'hat', .012)
        if bar >= 2:
            for part in range(2):
                offset = melody[(bar*2+part)%len(melody)]
                note(start+(part+.5)*2*beat, beat*(.7 if index in (0,2) else 1.3), freq(root+24+offset), .026, voice)
    fade = int(.12*RATE)
    mix[-fade:] *= np.linspace(1,0,fade)
    pcm = (np.tanh(mix*1.6)*21000).astype('<i2')
    with tempfile.TemporaryDirectory() as temp:
        source = Path(temp)/'track.wav'
        with wave.open(str(source),'wb') as wav:
            wav.setnchannels(1); wav.setsampwidth(2); wav.setframerate(RATE); wav.writeframes(pcm.tobytes())
        subprocess.run(['ffmpeg','-loglevel','error','-y','-i',str(source),'-codec:a','libmp3lame','-b:a','96k',str(OUT/f'{name}.mp3')],check=True)
    print(name)
