"""Inspect exported WAV/BRR files; report signal properties, not subjective listening."""
from pathlib import Path
import json
import hashlib
import wave
import numpy as np

root=Path(__file__).resolve().parent
manifest=json.loads((root/'manifest.json').read_text())
results=[]
for s in manifest['sounds']:
    path=root/s['file']
    with wave.open(str(path)) as w:
        assert w.getsampwidth()==2 and w.getframerate()==s['sample_rate']
        assert w.getnchannels()==s['channels']
        x=np.frombuffer(w.readframes(w.getnframes()),dtype='<i2').reshape(-1,w.getnchannels())/32768
    peak=float(np.max(abs(x)))
    assert 0.01<peak<=10**(-3/20)+1/32768
    assert np.max(abs(x[0]))==0 and np.max(abs(x[-1]))==0
    assert abs(len(x)/s['sample_rate']-s['seconds'])<.001
    assert hashlib.sha256(path.read_bytes()).hexdigest()==s['sha256']
    dc=float(np.max(abs(np.mean(x,axis=0))))
    assert dc<.002
    tail=float(np.sqrt(np.mean(x[-round(.01*s['sample_rate']):]**2)))
    assert tail<.002
    results.append({'file':path.name,'pass':True,'peak_dbfs':round(float(20*np.log10(peak)),2),
                    'dc_max':round(dc,7),'last_10ms_rms_dbfs':round(float(20*np.log10(max(tail,1e-10))),2)})
for name,meta in manifest['sfc_bank'].items():
    data=(root/'sfc-bank'/f'{name}.brr').read_bytes()
    assert len(data)==meta['bytes'] and len(data)%9==0
    assert len(data)//9*16==meta['samples']
    for i in range(0,len(data),9):
        h=data[i]
        assert 1<=h>>4<=12 and (h>>2)&3==0
        assert bool(h&1)==(i+9==len(data))
        assert bool(h&2)==meta['loop']
assert manifest['sfc_bank_bytes']+manifest['sfc_echo_buffer_bytes']<65536
out={'signal_checks':results,'brr_structure_checks':'4/4 passed','subjective_listening':'Not performed by an audio-listening tool; user audition pending.',
     'hardware_validation':'Not performed; this is hardware-informed synthesis, not emulator output.'}
(root/'quality.json').write_text(json.dumps(out,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(out,indent=2))
