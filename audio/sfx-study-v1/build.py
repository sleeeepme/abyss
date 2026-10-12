#!/usr/bin/env python3
"""Deterministic, original SFX study. Requires Python 3 + numpy; no downloaded audio."""
from pathlib import Path
import base64
import hashlib
import json
import math
import wave
import zipfile
import numpy as np

ROOT = Path(__file__).resolve().parent
TAU = 2 * np.pi
RNG = np.random.default_rng(20261002)
FILES = []
BANK = {}


def times(seconds, sr):
    return np.arange(round(seconds * sr)) / sr


def env(t, attack=.002, decay=.12):
    return np.minimum(t / attack, 1) * np.exp(-t / decay)


def tone(t, freq, sr):
    f = np.broadcast_to(freq, t.shape)
    return np.sin(TAU * np.cumsum(f) / sr)


def lowpass(x, hz, sr):
    a = 1 - math.exp(-TAU * hz / sr)
    y = np.empty_like(x)
    state = 0.
    for i, value in enumerate(x):
        state += a * (value - state)
        y[i] = state
    return y


def noise(n, sr, low, high):
    x = RNG.normal(size=n)
    f = np.fft.rfftfreq(n, 1 / sr)
    shape = (1 - np.exp(-(f / low) ** 4)) * np.exp(-(f / high) ** 4)
    x = np.fft.irfft(np.fft.rfft(x) * shape, n)
    return x / max(np.std(x), 1e-9)


def add(dst, src, start, sr, gain=1., pan=0.):
    offset = round(start * sr)
    n = min(len(src), len(dst) - offset)
    if n <= 0:
        return
    if dst.ndim == 1:
        dst[offset:offset+n] += src[:n] * gain
    else:
        dst[offset:offset+n, 0] += src[:n] * gain * math.sqrt((1-pan)/2)
        dst[offset:offset+n, 1] += src[:n] * gain * math.sqrt((1+pan)/2)


def room(x, sr, amount=.2):
    out = x.copy()
    for delay, gain in [(.029,.42),(.047,.35),(.079,.3),(.113,.24),(.173,.18),(.239,.12),(.317,.07)]:
        k = round(delay * sr)
        if k < len(x):
            wet = x[:-k, ::-1]
            out[k:] += wet * gain * amount
    return out


def modern(kind):
    sr = 48000
    duration = {'slash':.68, 'magic':1.22, 'ui':.38}[kind]
    out = np.zeros((round(sr * duration), 2))
    if kind == 'slash':
        t = times(.31, sr)
        swish = noise(len(t), sr, 850, 10500)
        air = noise(len(t), sr, 180, 1900)
        shape = (1 - np.exp(-t/.012)) * np.exp(-((t-.052)/.058)**2)
        add(out, swish * shape, 0, sr, .25, -.17)
        add(out, air * env(t,.028,.048), .012, sr, .29, .12)
        t = times(.4, sr)
        strike = sum(a*tone(t, f*(1+.025*np.exp(-t/.009)), sr)*env(t,.0009,d)
                     for f,a,d in [(1280,.18,.065),(2630,.11,.039),(4210,.055,.023)])
        strike += noise(len(t),sr,1700,12500)*env(t,.0007,.012)*.23
        strike += tone(t,95+150*np.exp(-t/.016),sr)*env(t,.001,.031)*.2
        add(out,strike,.061,sr,1,.08)
        out = room(out,sr,.10)
    elif kind == 'magic':
        t = times(.18,sr)
        phase = TAU*np.cumsum(240+1800*(t/.18)**2)/sr
        charge = np.sin(phase+1.1*np.sin(phase*1.501)) * np.sin(np.pi*t/.18)**1.5
        add(out,charge,0,sr,.14,-.12)
        t = times(.9,sr)
        freq = 165+950*np.exp(-t/.082)
        phase = TAU*np.cumsum(freq)/sr
        bolt = np.sin(phase+3.2*np.exp(-t/.14)*np.sin(phase*1.49))*env(t,.002,.15)
        bolt += .32*noise(len(t),sr,1000,10500)*env(t,.001,.047)
        bolt += .32*tone(t,70+95*np.exp(-t/.027),sr)*env(t,.002,.083)
        add(out,bolt,.145,sr,.47)
        for i,f in enumerate([1174.66,1760,2349.32,3520]):
            t = times(.64,sr)
            shimmer = (tone(t,f,sr)+.17*tone(t,2.76*f,sr))*env(t,.008,.13+i*.022)
            add(out,shimmer,.18+i*.042,sr,.08,(-1)**i*.62)
        out = room(out,sr,.48)
    else:
        for start,f,g in [(0,1174.66,.36),(.066,1760,.31)]:
            t = times(.27,sr)
            note = (tone(t,f,sr)+.22*tone(t,2.01*f,sr)+.06*tone(t,3.87*f,sr))*env(t,.0017,.036)
            add(out,note,start,sr,g)
        out = room(out,sr,.11)
    return out,sr


def brr_roundtrip(name, signal, loop=False):
    """Valid BRR filter-0 blocks, choosing range by minimum squared error.
    Filter 0 is intentional: simple independently decodable instrument bank.
    Render decoder follows ((signed_nibble << range) >> 1) << 1.
    """
    pcm = np.round(np.clip(signal,-.88,.88)*32767).astype(np.int64)
    pcm = np.pad(pcm,(0,(-len(pcm))%16))
    blob = bytearray()
    decoded = []
    for offset in range(0,len(pcm),16):
        block = pcm[offset:offset+16]
        best = None
        for shift in range(1,13):
            q = np.clip(np.round(block/(1<<shift)),-8,7).astype(np.int64)
            error = np.sum((block-q*(1<<shift))**2)
            if best is None or error < best[0]:
                best = error,shift,q
        _,shift,q = best
        end = offset+16 == len(pcm)
        blob.append((shift<<4) | int(end) | (2 if loop else 0))
        for i in range(0,16,2):
            blob.append(((int(q[i])&15)<<4) | (int(q[i+1])&15))
        decoded.extend(q*(1<<shift)/32768)
    path = ROOT/'sfc-bank'/f'{name}.brr'
    path.parent.mkdir(exist_ok=True)
    path.write_bytes(blob)
    BANK[name] = {'bytes':len(blob),'samples':len(pcm),'loop':loop,'loop_offset_bytes':0 if loop else None,'filter':0}
    return np.array(decoded)


def make_bank():
    sr = 16000
    t = times(.18,sr)
    air = noise(len(t),sr,700,6500)*np.sin(np.pi*t/.18)**2
    air = brr_roundtrip('air',air/max(abs(air))*.75)
    t = times(.19,sr)
    metal = sum(a*tone(t,f,sr)*env(t,.001,d) for f,a,d in [(1200,.48,.055),(2560,.25,.038),(3800,.14,.02)])
    metal += noise(len(t),sr,1500,7000)*env(t,.001,.012)*.1
    metal = brr_roundtrip('metal',metal)
    t = times(.25,sr)
    crystal = sum(a*tone(t,f,sr)*env(t,.002,d) for f,a,d in [(880,.6,.07),(1760,.18,.042),(2446,.08,.03)])
    crystal = brr_roundtrip('crystal',crystal)
    p = np.arange(64)/64
    orb = brr_roundtrip('orb',.54*np.sin(TAU*p)+.16*np.sin(2*TAU*p)+.06*np.sin(3*TAU*p),True)
    return air,metal,crystal,orb


def playback(sample, sr, source_sr=16000, ratio=1, seconds=None, loop=False):
    n = round((len(sample)/source_sr/ratio if seconds is None else seconds)*sr)
    rate = np.broadcast_to(ratio,(n,))
    # DSP pitch register is quantized to 1/4096 of the 32 kHz output clock.
    pitch = np.round(rate*source_sr/sr*4096)/4096
    pos = np.cumsum(pitch)-pitch[0]
    if loop:
        pos %= len(sample)
    padded = np.append(sample,sample[0] if loop else 0.)
    y = np.interp(pos,np.arange(len(padded)),padded,left=0,right=0)
    # Compact smoothing approximation, NOT the hardware Gaussian lookup table.
    return np.convolve(y,[.08,.24,.36,.24,.08],mode='same')


def sfc(kind, bank):
    sr = 32000
    air,metal,crystal,orb = bank
    duration = {'slash':.62,'magic':1.13,'ui':.35}[kind]
    out = np.zeros((round(duration*sr),2))
    if kind == 'slash':
        add(out,playback(air,sr,ratio=1.24),0,sr,.48,-.12)
        add(out,playback(metal,sr,ratio=.94),.055,sr,.73,.12)
        t = times(.14,sr)
        y = playback(orb,sr,ratio=(120+80*np.exp(-t/.023))/250,seconds=.14,loop=True)
        add(out,y*env(t,.001,.027),.055,sr,.3)
        echo = .12
    elif kind == 'magic':
        t = times(.155,sr)
        y = playback(orb,sr,ratio=(300+1100*(t/.155)**2)/250,seconds=.155,loop=True)
        add(out,y*np.sin(np.pi*t/.155)**1.2,0,sr,.26,-.1)
        t = times(.42,sr)
        y = playback(orb,sr,ratio=(180+850*np.exp(-t/.055))/250,seconds=.42,loop=True)
        add(out,y*env(t,.002,.11),.145,sr,.57)
        add(out,playback(air,sr,ratio=1.35),.145,sr,.43)
        for i,ratio in enumerate([4/3,2,8/3]):
            add(out,playback(crystal,sr,ratio=ratio),.19+i*.052,sr,.3,[-.4,.4,0][i])
        echo = .3
    else:
        for start,ratio in [(0,4/3),(.066,2)]:
            add(out,playback(crystal,sr,ratio=ratio),start,sr,.55)
        echo = .09
    # One shared 96 ms stereo feedback echo; 8-tap FIR per pass.
    delay = round(.096*sr)
    wet = out.copy()
    for iteration in range(1,7):
        filtered = np.stack([np.convolve(wet[:,c],[.5,.25,.125,.0625,.03125,.015625,.0078125,.0078125],mode='full')[:len(out)] for c in range(2)],axis=1)
        wet = np.zeros_like(out)
        wet[delay:] = filtered[:-delay]*.32
        out += wet * echo/.32
    return out,sr


def gb_env(t,initial=15,pace=1):
    return np.maximum(initial-np.floor(t*64/pace),0)/15


def gb_pulse(t,freq,sr,duty=.25,initial=12,pace=1):
    period = np.clip(np.round(2048-131072/np.asarray(freq)),0,2047)
    f = 131072/(2048-period)
    phase = np.cumsum(np.broadcast_to(f,t.shape))/sr
    return np.where(phase%1<duty,1.,-1.)*gb_env(t,initial,pace)


def gb_noise(t,sr,short=False):
    # NR43 values at 128 Hz driver ticks. Actual legal divider + shift clocks.
    values = [(2,1),(1,1),(2,2),(3,2),(3,3),(4,3),(5,3),(6,3)]
    phase,state = 0.,0
    out = np.empty(len(t))
    for i,tm in enumerate(t):
        divider,shift = values[min(int(tm*128),len(values)-1)]
        phase += 262144/(divider*2**shift)/sr
        while phase>=1:
            bit = 1 ^ ((state&1)^((state>>1)&1))
            state = (state>>1) | (bit<<14)
            if short:
                state = (state & ~(1<<6)) | (bit<<6)
            phase -= 1
        out[i] = 1 if state&1 else -1
    return out


def gb(kind):
    # 4x render for output antialiasing; hardware-inspired synthesis, no emulator ROM.
    sr = 192000
    duration = {'slash':.32,'magic':.62,'ui':.25}[kind]
    out = np.zeros(round(duration*sr))
    if kind == 'slash':
        t = times(.24,sr)
        add(out,gb_noise(t,sr)*gb_env(t,15,1),0,sr,.58)
        t = times(.14,sr)
        freq = 980*np.exp(-np.floor(t*128)/128/.039)+145
        add(out,gb_pulse(t,freq,sr,.125,8,1),.025,sr,.36)
    elif kind == 'magic':
        t = times(.145,sr)
        freq = 294*2**(np.floor(t*128)/128/.075)
        add(out,gb_pulse(t,freq,sr,.25,7,2),0,sr,.45)
        t = times(.25,sr)
        freq = 220+1350*np.exp(-np.floor(t*128)/128/.043)
        add(out,gb_pulse(t,freq,sr,.125,15,1),.145,sr,.44)
        add(out,gb_noise(t,sr,True)*gb_env(t,10,1),.145,sr,.31)
        # CH2 ascending spark sequence; a single pulse voice, never overlapping itself.
        for i,f in enumerate([1174.66,1760,2349.32]):
            t = times(.065 if i<2 else .125,sr)
            add(out,gb_pulse(t,f,sr,.5,7-i,1),.22+i*.065,sr,.28)
    else:
        # One pulse voice, matching the modern/SFC perfect-fifth confirmation motif.
        for start,seconds,f,vol in [(0,.066,1174.66,9),(.066,.17,1760,10)]:
            t = times(seconds,sr)
            add(out,gb_pulse(t,f,sr,.25,vol,1),start,sr,.7)
    # Analog output approximation: DC blocking + band limitation, no reverb.
    out -= lowpass(out,35,sr)
    out = lowpass(lowpass(out,12500,sr),12500,sr)
    return out.reshape(-1,4).mean(axis=1),48000


def master(x,sr,kind):
    if x.ndim==1:
        x=x[:,None]
    for c in range(x.shape[1]):
        x[:,c] -= lowpass(x[:,c],22,sr)
    # Short file-edge fades only; chip envelope steps within the sound are retained.
    head,tail=round(.001*sr),round(.016*sr)
    x[:head] *= np.linspace(0,1,head)[:,None]
    x[-tail:] *= np.linspace(1,0,tail)[:,None]
    power=np.mean(x*x,axis=1)
    active=power>np.max(power)*.001
    rms=np.sqrt(np.mean(power[active]))
    target=10**(({'slash':-19,'magic':-20,'ui':-23}[kind])/20)
    gain=min(target/rms,10**(-3/20)/np.max(abs(x)))
    return x*gain


def write_wav(path,x,sr):
    if x.ndim==1:
        x=x[:,None]
    pcm=np.round(np.clip(x,-1,1)*32767).astype('<i2')
    with wave.open(str(path),'wb') as f:
        f.setnchannels(x.shape[1]); f.setsampwidth(2); f.setframerate(sr); f.writeframes(pcm.tobytes())


def main():
    bank=make_bank()
    reels={}
    for kind in ['slash','magic','ui']:
        reels[kind]=[]
        for style,renderer in [('unrestricted',modern),('sfc',lambda k:sfc(k,bank)),('gb',gb)]:
            x,sr=renderer(kind)
            x=master(x,sr,kind)
            path=ROOT/f'{kind}-{style}.wav'
            write_wav(path,x,sr)
            power=np.mean(x*x,axis=1)
            active=power>np.max(power)*.001
            entry={'id':f'{kind}-{style}','kind':kind,'style':style,'file':path.name,'sample_rate':sr,'channels':x.shape[1],
                   'seconds':round(len(x)/sr,3),'peak_dbfs':round(float(20*np.log10(np.max(abs(x)))),2),
                   'active_rms_dbfs':round(float(10*np.log10(np.mean(power[active]))),2),
                   'sha256':hashlib.sha256(path.read_bytes()).hexdigest(),
                   'waveform':[round(float(np.max(abs(chunk))),4) for chunk in np.array_split(x,100)]}
            FILES.append(entry)
            # Shared 48 kHz comparison reel; resampling only affects this convenience file.
            xp=np.stack([np.interp(np.arange(round(len(x)*48000/sr))*sr/48000,np.arange(len(x)),x[:,c]) for c in range(x.shape[1])],axis=1)
            if xp.shape[1]==1: xp=np.repeat(xp,2,axis=1)
            reels[kind].extend([xp,np.zeros((round(.55*48000),2))])
        write_wav(ROOT/f'compare-{kind}.wav',np.concatenate(reels[kind]),48000)
    manifest={'version':1,'seed':20261002,'format':'16-bit PCM WAV','sounds':FILES,'sfc_bank':BANK,
              'sfc_bank_bytes':sum(v['bytes'] for v in BANK.values()),'sfc_echo_buffer_bytes':12288,
              'sfc_peak_voices':{'slash':3,'magic':4,'ui':2},'gb_peak_voices':{'slash':2,'magic':3,'ui':1},
              'fidelity':'Hardware-informed synthesis, not cycle-accurate emulation or real-console recordings.'}
    (ROOT/'manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
    embedded=[]
    for item in FILES:
        embedded.append(dict(item,url='data:audio/wav;base64,'+base64.b64encode((ROOT/item['file']).read_bytes()).decode()))
    template=(ROOT/'preview.template.html').read_text()
    (ROOT/'index.html').write_text(template.replace('__SOUND_DATA__',json.dumps(embedded,ensure_ascii=False)))
    archive=ROOT/'abyss-sfx-study-v1.zip'
    with zipfile.ZipFile(archive,'w',zipfile.ZIP_DEFLATED) as z:
        for path in sorted(ROOT.rglob('*')):
            if path.is_file() and path!=archive and '__pycache__' not in path.parts:
                z.write(path,path.relative_to(ROOT))
    print(json.dumps({'created':len(FILES),'sfc_bank_bytes':manifest['sfc_bank_bytes'],'sounds':[{k:v for k,v in s.items() if k not in ('waveform','sha256')} for s in FILES]},indent=2))


if __name__=='__main__':
    main()
