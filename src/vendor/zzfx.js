// ZzFX - Zuper Zmall Zound Zynth - Micro Edition
// MIT License - Copyright 2019 Frank Force
// https://github.com/KilledByAPixel/ZzFX

// This is a minified build of zzfx for use in size coding projects.
// You can use zzfxV to set volume.
// Feel free to minify it further for your own needs!

///////////////////////////////////////////////////////////////////////////////

'use strict';

// ZzFXMicro - Zuper Zmall Zound Zynth - v1.3.2 by Frank Force

const zzfxV = .3; // volume
let zzfxX; // audio context — created lazily, see the local addition at the end of this file
const zzfx = // generate samples
(
    volume = 1,
    randomness = .05,
    frequency = 220,
    attack = 0,
    sustain = 0,
    release = .1,
    shape = 0,
    shapeCurve = 1,
    slide = 0,
    _deltaSlide = 0, 
    pitchJump = 0,
    pitchJumpTime = 0,
    repeatTime = 0,
    noise = 0,
    modulation = 0,
    bitCrush = 0,
    delay = 0,
    sustainVolume = 1,
    decay = 0,
    tremolo = 0
)=>
{
    // init parameters
    const sampleRate = 44100;
    let PI2 = Math.PI*2,
        abs = Math.abs,
        sign = v => v<0?-1:1,
        startSlide = slide *= 500 * PI2 / sampleRate / sampleRate,
        startFrequency = frequency *=
            (1 + randomness*2*Math.random() - randomness) * PI2 / sampleRate,
        modOffset = 0, // modulation offset
        repeat = 0,    // repeat offset
        crush = 0,     // bit crush offset
        jump = 1,      // pitch jump timer
        length,        // sample length
        b = [],        // sample buffer
        t = 0,         // sample time
        i = 0,         // sample index
        s = 0,         // sample value
        f,             // wave frequency

        // source and buffer
        source = zzfxX.createBufferSource(),
        buffer;

    // scale by sample rate
    const minAttack = 9; // prevent pop if attack is 0
    attack = attack * sampleRate || minAttack;
    decay *= sampleRate;
    sustain *= sampleRate;
    release *= sampleRate;
    delay *= sampleRate;
    modulation *= PI2 / sampleRate;
    pitchJump *= PI2 / sampleRate;
    pitchJumpTime *= sampleRate;
    repeatTime = repeatTime * sampleRate | 0;
    volume *= zzfxV;

    // generate waveform
    for(length = attack + decay + sustain + release + delay | 0;
        i < length; b[i++] = s * volume)                   // sample
    {
        if (!(++crush%(bitCrush*100|0)))                   // bit crush
        {
            s = shape? shape>1? shape>2? shape>3?          // wave shape
                Math.sin(t**3) :                           // 4 noise
                Math.max(Math.min(Math.tan(t),1),-1):      // 3 tan
                1-(2*t/PI2%2+2)%2:                         // 2 saw
                1-4*abs(Math.round(t/PI2)-t/PI2):          // 1 triangle
                Math.sin(t);                               // 0 sin

            s = (repeatTime ?
                    1 - tremolo + tremolo*Math.sin(PI2*i/repeatTime) // tremolo
                    : 1) *
                sign(s)*abs(s)**shapeCurve *             // shape curve
                (i < attack ? i/attack :                 // attack
                i < attack + decay ?                     // decay
                1-((i-attack)/decay)*(1-sustainVolume) : // decay falloff
                i < attack  + decay + sustain ?          // sustain
                sustainVolume :                          // sustain volume
                i < length - delay ?                     // release
                (length - i - delay)/release *           // release falloff
                sustainVolume :                          // release volume
                0);                                      // post release

            s = delay ? s/2 + (delay > i ? 0 :           // delay
                (i<length-delay? 1 : (length-i)/delay) * // release delay
                b[i-delay|0]/2/volume) : s;              // sample delay

        }

        f = (frequency += slide) *              // frequency
            Math.cos(modulation*modOffset++);   // modulation
        t += f + f*noise*Math.sin(i**5);        // noise

        if (jump && ++jump > pitchJumpTime)     // pitch jump
        {
            frequency += pitchJump;             // apply pitch jump
            startFrequency += pitchJump;        // also apply to start
            jump = 0;                           // stop pitch jump time
        }

        if (repeatTime && !(++repeat % repeatTime)) // repeat
        {
            frequency = startFrequency;   // reset frequency
            slide = startSlide;           // reset slide
            jump ||= 1;                   // reset pitch jump time
        }
    }

    // copy samples to buffer and play
    buffer = zzfxX.createBuffer(1, b.length, sampleRate);
    buffer.getChannelData(0).set(b)
    source.buffer = buffer;
    source.connect(zzfxX.destination);
    source.start();
    return source;
}

// Local additions to the upstream file:
//
// 0. Three features none of this game's sounds use are cut for size: deltaSlide, the
//    biquad filter, and wave shape 5 (square with duty). The parameter positions are kept.
//
// 1. ZzFXMicro is a global script; expose it as a module for the bundler.
// 2. `zzfxX` was `const zzfxX = new AudioContext`, built when the module loads. Both
//    Chrome and Firefox then warn on every page load that an AudioContext may not start
//    before a user gesture. Creating it on the first sound instead keeps the console
//    clean, and the first sound always follows a click or a keypress.
export const zzfxInit = () => (zzfxX = zzfxX || new AudioContext());
export { zzfx, zzfxV };
