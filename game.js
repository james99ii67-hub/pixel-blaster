"use strict";

(() => {
  // Each bar has eight eighth notes. Digits are scale steps above its chord,
  // a tilde holds the previous note, and a dash leaves space.
  const major = [0, 2, 4, 5, 7, 9, 11];
  const minor = [0, 2, 3, 5, 7, 8, 10];
  const scores = {
    meadow: { bpm: 120, tonic: 72, scale: major, voice: "triangle",
      chords: [0, 3, -2, -3, 0, 3, -3, 0],
      bars: ["2~40-24~", "0~24~2-1", "4~-2704~", "2~~-10~-", "2~40-267", "4~2-0~24", "1~32~1-4", "2~10~~~-" ] },
    grove: { bpm: 100, tonic: 69, scale: minor, voice: "triangle",
      chords: [0, -2, 3, 0, 2, 3, -3, 0],
      bars: ["-02~4~2-", "0~~-2~10", "-24~6~4-", "2~~~0~--", "-42~0~24", "2~~-4~64", "4~321~2-", "0~~~~~--"] },
    valley: { bpm: 128, tonic: 74, scale: major, voice: "sine",
      chords: [0, -3, -2, 3, 0, -2, -3, 0],
      bars: ["024~7-42", "1~424~2-", "024~6-42", "4~2-0~1-", "024~7-67", "4~246~4-", "42-10~21", "0~~~4~--"] },
    frost: { bpm: 94, tonic: 71, scale: minor, voice: "sine",
      chords: [0, 3, -1, -2, 0, 2, -3, 0],
      bars: ["4~~~2-10", "2~~-4~6-", "4~~~20~-", "1~2~0~--", "7~~~4-24", "6~~-4~2-", "4~21~2~-", "0~~~~~--"] },
    ruins: { bpm: 134, tonic: 65, scale: minor, voice: "triangle",
      chords: [0, 0, -1, -3, 0, 3, -1, -3],
      bars: ["0-042~10", "2~4-0-21", "0-042~46", "4~~-2~1-", "0-047~64", "2~4-6-42", "4-20-210", "1~~-4-2-"] },
    boss: { bpm: 158, tonic: 62, scale: minor, voice: "square", battle: true,
      chords: [0, -1, 0, -3, 3, -2, -3, 0],
      bars: ["0-074-20", "4-214~2-", "0-074-67", "4~210-24", "7-646-42", "4~2-0742", "41-241-2", "0~0-0~--"] },
    crystalBoss: { bpm: 144, tonic: 70, scale: minor, voice: "sine", battle: true,
      chords: [0, 2, -2, 1, 0, 3, -1, 0],
      bars: ["70-4~24-", "52-7~42-", "64-2~406", "1~360~--", "70-4~267", "43-7~642", "6~4-2031", "0~~-4~--"] },
    finalPhase: { bpm: 174, tonic: 60, scale: minor, voice: "square", battle: true,
      chords: [0, 1, -2, 0, 3, -1, 1, 0],
      bars: ["04-06074", "26-4212-", "04-06470", "3~2-10-4", "74-20764", "3~5-3210", "21-42146", "0-70~---"] }
  };

  function createGameAudio() {
    const button = document.querySelector("#sound");
    const Audio = window.AudioContext || window.webkitAudioContext;
    const storageKey = "pixel-blaster.sound";
    let enabled = true;
    try { enabled = window.localStorage.getItem(storageKey) !== "off"; } catch {}
    const musicButton = document.querySelector("#music");
    const musicKey = "pixel-blaster.music";
    let musicEnabled = enabled;
    try {
      const saved = window.localStorage.getItem(musicKey);
      if (saved == null) window.localStorage.setItem(musicKey, enabled ? "on" : "off");
      else musicEnabled = saved !== "off";
    } catch {}
    let track, musicBus, tick = 0, nextNote = 0;
    let context, output, sustained;
    let active = true;
    let lastHit = -1;

    function updateButton() {
      musicButton.disabled = !Audio;
      musicButton.textContent = Audio && musicEnabled ? "♫ 音樂開" : "♫ 音樂關";
      musicButton.setAttribute("aria-pressed", String(Boolean(Audio && musicEnabled)));
      button.disabled = !Audio;
      button.textContent = Audio && enabled ? "♪ 音效開" : "♪ 音效關";
      button.setAttribute("aria-pressed", String(Boolean(Audio && enabled)));
      button.title = Audio ? "切換遊戲音效" : "此瀏覽器無法播放遊戲音效";
    }

    function unlock() {
      if (!Audio || (!enabled && !musicEnabled) || !active || document.hidden) return;
      try {
        if (!context) {
          context = new Audio();
          output = context.createGain();
          output.gain.value = 0.18;
          output.connect(context.destination);
        }
        if (context.state !== "running") context.resume().catch(() => {});
      } catch {} // The next keyboard or touch gesture can retry audio activation.
    }

    function audible() {
      return enabled && active && !document.hidden && context?.state === "running";
    }

    function tone(type, from, to, duration, delay = 0, volume = 0.32) {
      if (!audible()) return;
      playTone(output, context.currentTime + delay, type, from, to, duration, volume);
    }

    function playTone(bus, start, type, from, to, duration, volume) {
      const osc = context.createOscillator();
      const envelope = context.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(from, start);
      osc.frequency.exponentialRampToValueAtTime(to, start + duration);
      envelope.gain.setValueAtTime(0.0001, start);
      envelope.gain.linearRampToValueAtTime(volume, start + 0.005);
      envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      osc.connect(envelope);
      envelope.connect(bus);
      osc.onended = () => { osc.disconnect(); envelope.disconnect(); };
      osc.start(start);
      osc.stop(start + duration + 0.01);
    }

    function sustain(kind) {
      if (!audible()) kind = null;
      if ((sustained?.kind ?? null) === kind) return;
      const now = context.currentTime;
      if (sustained) {
        const { carrier, modulation, envelope } = sustained;
        envelope.gain.cancelScheduledValues(now);
        envelope.gain.setTargetAtTime(0, now, 0.006);
        carrier.stop(now + 0.035);
        modulation.stop(now + 0.035);
        sustained = null;
      }
      if (!kind) return;
      const electric = kind === "lightning";
      const carrier = context.createOscillator();
      const modulation = context.createOscillator();
      const depth = context.createGain();
      const envelope = context.createGain();
      carrier.type = electric ? "sawtooth" : "triangle";
      carrier.frequency.value = electric ? 148 : 216;
      modulation.type = electric ? "square" : "sine";
      modulation.frequency.value = electric ? 34 : 9;
      depth.gain.value = electric ? 53 : 17;
      modulation.connect(depth);
      depth.connect(carrier.frequency);
      carrier.connect(envelope);
      envelope.connect(output);
      envelope.gain.setValueAtTime(0, now);
      envelope.gain.setTargetAtTime(electric ? 0.16 : 0.27, now, 0.008);
      carrier.onended = () => {
        carrier.disconnect(); modulation.disconnect(); depth.disconnect(); envelope.disconnect();
      };
      carrier.start(now);
      modulation.start(now);
      sustained = { kind, carrier, modulation, envelope };
    }

    // Disconnect the old mix after its scheduled notes have faded out.
    function stopMusic() {
      if (!musicBus) return;
      const fading = musicBus;
      musicBus = null;
      fading.gain.cancelScheduledValues(context.currentTime);
      fading.gain.setTargetAtTime(0, context.currentTime, 0.008);
      window.setTimeout(() => fading.disconnect(), 65);
    }

    function setTrack(name) {
      stopMusic();
      track = scores[name];
      tick = 0;
    }

    function scheduleMusic() {
      if (!musicEnabled || !active || document.hidden || !track || context?.state !== "running") {
        stopMusic();
        return;
      }
      const now = context.currentTime;
      if (!musicBus) {
        musicBus = context.createGain();
        musicBus.gain.value = 0.095;
        musicBus.connect(context.destination);
        nextNote = now + 0.025;
      }
      // Schedule against the audio clock instead of tying tempo to the frame rate.
      if (nextNote < now) nextNote = now + 0.015;
      const eighth = 30 / track.bpm;
      while (nextNote < now + 0.19) {
        const bar = Math.floor(tick / 8);
        const beat = tick % 8;
        const phrase = track.bars[bar];
        const chord = track.chords[bar];
        const pitch = degree => {
          const n = chord + degree;
          const midi = track.tonic + 12 * Math.floor(n / 7) + track.scale[(n % 7 + 7) % 7];
          return 440 * 2 ** ((midi - 69) / 12);
        };
        const note = phrase[beat];
        if (note !== "-" && note !== "~") {
          let beats = 1;
          while (phrase[beat + beats] === "~") beats++;
          const hz = pitch(Number(note));
          playTone(musicBus, nextNote, track.voice, hz, hz, beats * eighth * 0.94,
            track.voice === "square" ? 0.22 : 0.46);
        }
        const battle = track.battle;
        if (beat % 4 === 0 || (battle && beat % 2 === 0)) {
          const hz = pitch(beat === 4 ? 4 : 0) / 4;
          playTone(musicBus, nextNote, "triangle", hz, hz, eighth * (battle ? 1.1 : 1.8), 0.45);
        }
        if (beat % 2 === 1) {
          const hz = pitch([0, 2, 4, 2][(beat - 1) / 2]) / 2;
          playTone(musicBus, nextNote, "triangle", hz, hz, eighth * 0.68, 0.2);
        }
        if (beat === 0 || (battle && beat === 6)) {
          playTone(musicBus, nextNote, "sine", 125, 48, 0.095, 0.38);
        }
        tick = (tick + 1) % (track.bars.length * 8);
        nextNote += eighth;
      }
    }

    function setOutput() {
      if (output) output.gain.setTargetAtTime(enabled && active ? 0.18 : 0, context.currentTime, 0.005);
      if (!enabled || !active) sustain(null);
    }

    button.addEventListener("click", () => {
      enabled = !enabled;
      try { window.localStorage.setItem(storageKey, enabled ? "on" : "off"); } catch {}
      updateButton();
      unlock();
      setOutput();
      if (enabled) tone("triangle", 523, 784, 0.12);
    });
    musicButton.addEventListener("click", () => {
      musicEnabled = !musicEnabled;
      try { window.localStorage.setItem(musicKey, musicEnabled ? "on" : "off"); } catch {}
      updateButton();
      unlock();
      if (!musicEnabled) stopMusic();
    });
    function setActive(value) {
      active = value;
      if (!active) stopMusic();
      setOutput();
    }
    updateButton();

    return {
      unlock, sustain, setActive, setTrack, scheduleMusic,
      jump() { tone("square", 270, 670, 0.12, 0, 0.19); },
      gem() { tone("sine", 880, 880, 0.09); tone("sine", 1320, 1320, 0.13, 0.07); },
      brick() {
        tone("triangle", 170, 75, 0.07);
        [523, 659, 784, 1047].forEach((hz, i) => tone("square", hz, hz, 0.09, 0.04 + i * 0.065, 0.2));
      },
      shot(index) {
        if (index === 0) tone("square", 680, 260, 0.085, 0, 0.2);
        if (index === 1) { tone("sawtooth", 240, 55, 0.12); tone("square", 520, 140, 0.07, 0.018, 0.13); }
        if (index === 2) tone("triangle", 1250, 90, 0.24, 0, 0.48);
        if (index === 4) tone("sawtooth", 128, 45, 0.095, 0, 0.25);
      },
      hit() {
        if (!audible() || context.currentTime - lastHit < 0.075) return;
        lastHit = context.currentTime;
        tone("triangle", 200, 80, 0.07);
      },
      hurt() { tone("sawtooth", 270, 65, 0.24); },
      domain() {
        tone("sine", 248, 82, 0.64, 0, 0.36);
        tone("triangle", 196, 392, 0.44, 0.06, 0.23);
        tone("sine", 588, 590, 0.58, 0.19, 0.32);
        tone("sine", 880, 880, 0.46, 0.31, 0.19);
      },
      ultimate(astral) {
        tone("triangle", astral ? 540 : 220, 75, 0.4, 0, 0.35);
        tone(astral ? "sine" : "sawtooth", astral ? 320 : 840, 125, 0.23, 0.055, 0.17);
      },
      temple() {
        tone("triangle", 133, 62, 0.52, 0, 0.33);
        tone("sawtooth", 540, 170, 0.14, 0.08, 0.14);
        tone("triangle", 370, 93, 0.31, 0.22, 0.22);
      },
      crystalEnter() {
        [277, 415, 622, 831].forEach((hz, i) => tone("sine", hz, hz, 0.29, i * 0.1, 0.32));
        tone("triangle", 139, 104, 0.45, 0.32, 0.27);
      },
      crystalHit() {
        if (!audible() || context.currentTime - lastHit < 0.1) return;
        lastHit = context.currentTime;
        tone("triangle", 787, 570, 0.085, 0, 0.23);
        tone("sine", 1208, 1103, 0.12, 0.02, 0.16);
      },
      crystalDefeat() {
        [932, 740, 554, 370].forEach((hz, i) => tone("sine", hz, hz * 0.98, 0.27, i * 0.067, 0.3));
        tone("triangle", 277, 415, 0.38, 0.29, 0.29);
      },
      phaseShift() {
        tone("sawtooth", 146, 74, 0.39, 0, 0.2);
        tone("triangle", 110, 330, 0.48, 0.14, 0.31);
        tone("square", 392, 392, 0.12, 0.48, 0.19);
        tone("square", 587, 587, 0.21, 0.64, 0.19);
      },
      warning(pattern) {
        const notes = { rain: [440, 330], curtain: [330, 440], volley: [392, 392, 392],
          seeker: [466, 554, 698], lattice: [622, 466, 622], quake: [277, 208], crossfire: [311, 466, 311] };
        (notes[pattern] ?? [392]).forEach((hz, i) => tone("square", hz, hz, 0.1, i * 0.14, 0.26));
      },
      barrage() { tone("sawtooth", 175, 48, 0.22); },
      finish(won) {
        const notes = won ? [523, 659, 784, 1047] : [330, 277, 220, 165];
        notes.forEach((hz, i) => tone("triangle", hz, hz, i === 3 ? 0.32 : 0.14, i * 0.12, 0.46));
      }
    };
  }

  const sound = createGameAudio();

  const canvas = document.querySelector("#game");
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  const groundY = 224;
  const maxHealth = 3;
  const step = 1 / 60;
  const ink = "#252943";
  const shotColors = ["#fa69a2", "#ffd85a", "#67e6f7", "#ba9aff"];
  const meadowPlatforms = [
    [0, groundY, 484], [536, groundY, 420], [1008, groundY, 425],
    [1490, groundY, 425], [1969, groundY, 383], [2407, groundY, 305],
    [111, 177, 88], [238, 146, 81], [358, 190, 89],
    [554, 176, 80], [701, 149, 100], [844, 180, 75],
    [1022, 187, 76], [1159, 155, 82], [1291, 176, 87],
    [1512, 184, 68], [1649, 152, 98], [1783, 182, 85],
    [1994, 177, 72], [2123, 146, 92], [2250, 183, 77],
    [2423, 180, 85], [2534, 153, 76]
  ];

  const meadowEnemies = [
    [352, 319, 439, 26, 0], [622, 589, 687, 32, 1], [745, 709, 788, 24, 0, 149],
    [867, 810, 930, 37, 2], [1105, 1064, 1156, 35, 1], [1319, 1270, 1395, 40, 0],
    [1573, 1531, 1636, 36, 2], [1692, 1657, 1735, 29, 1, 152],
    [1815, 1762, 1880, 42, 0], [2063, 2016, 2106, 42, 1], [2219, 2165, 2310, 45, 2],
    [2517, 2477, 2584, 43, 0]
  ];
  const meadowGems = [
    [143, 162], [170, 162], [278, 130], [398, 175], [508, 190],
    [593, 161], [750, 133], [879, 164], [981, 189], [1057, 172],
    [1200, 140], [1334, 160], [1460, 188], [1549, 169], [1698, 136],
    [1826, 167], [1941, 188], [2030, 161], [2169, 131], [2288, 167],
    [2378, 188], [2464, 165], [2572, 138]
  ];
  const levels = [
    {
      name: "晴光草原", width: 2712, goal: 2620, theme: "meadow",
      platforms: meadowPlatforms, enemies: meadowEnemies, gems: meadowGems, supplies: [[206, 159, 1]]
    },
    {
      name: "暮光菇林", width: 2210, goal: 2115, theme: "grove", supplies: [[210, 159, 4], [551, 157, 3]],
      platforms: [
        [0, groundY, 375], [433, groundY, 374], [871, groundY, 380],
        [1314, groundY, 357], [1732, groundY, 478],
        [109, 182, 91], [249, 153, 107], [455, 180, 74], [588, 145, 115],
        [743, 177, 89], [904, 185, 84], [1054, 153, 103], [1181, 187, 61],
        [1344, 177, 79], [1499, 145, 96], [1621, 181, 70], [1770, 174, 86],
        [1919, 148, 113]
      ],
      enemies: [
        [257, 218, 322, 39, 1, groundY, "hopper"],
        [512, 475, 572, 50, 2, 193, "bat"],
        [664, 620, 750, 30, 0], [942, 912, 987, 42, 1, groundY, "hopper"],
        [1085, 1022, 1160, 57, 2, 190, "bat"], [1210, 1152, 1222, 24, 2],
        [1385, 1360, 1460, 45, 1, groundY, "hopper"],
        [1578, 1516, 1650, 62, 2, 195, "bat"], [1813, 1783, 1878, 41, 2, groundY, "hopper"],
        [1965, 1920, 2050, 49, 2, 191, "bat"]
      ],
      gems: [[160, 165], [296, 136], [406, 186], [495, 163], [644, 129], [788, 161],
        [836, 188], [950, 168], [1100, 137], [1280, 186], [1385, 160], [1550, 129],
        [1703, 185], [1816, 158], [1973, 132], [2045, 204]]
    },
    {
      arena: { kind: "crystal", name: "星砂守護者", start: 1860, bossX: 2185, gate: 2276 },
      name: "星砂晶谷", width: 2410, goal: 2315, theme: "valley", supplies: [[221, 159, 2], [1975, 159, 5]],
      platforms: [
        [0, groundY, 401], [462, groundY, 383], [912, groundY, 379],
        [1357, groundY, 419], [1842, groundY, 568],
        [128, 180, 84], [260, 150, 105], [480, 181, 83], [625, 150, 93],
        [782, 174, 80], [939, 180, 82], [1078, 148, 97], [1219, 177, 65],
        [1375, 185, 81], [1536, 153, 99], [1690, 177, 89], [1875, 183, 85],
        [2018, 149, 98], [2178, 177, 112]
      ],
      enemies: [
        [251, 220, 331, 29, 0, groundY, "beetle"],
        [344, 344, 344, 0, 2, groundY, "caster"],
        [526, 499, 610, 46, 1, groundY, "hopper"], [728, 710, 788, 32, 0, groundY, "beetle"],
        [972, 945, 1015, 49, 2, 189, "bat"], [1134, 1134, 1134, 0, 2, groundY, "caster"],
        [1255, 1228, 1266, 32, 0, groundY, "beetle"],
        [1465, 1430, 1515, 35, 0, groundY, "beetle"], [1612, 1612, 1612, 0, 2, 153, "caster"],
        [1717, 1660, 1744, 54, 2, 198, "bat"], [1921, 1890, 1998, 49, 1, groundY, "hopper"],
        [2101, 2101, 2101, 0, 2, groundY, "caster"], [2210, 2170, 2268, 37, 0, groundY, "beetle"]
      ],
      gems: [[172, 163], [312, 134], [431, 187], [526, 165], [670, 134], [819, 159],
        [876, 185], [978, 164], [1125, 131], [1324, 186], [1415, 169], [1587, 137],
        [1807, 185], [1918, 167], [2066, 133], [2235, 161], [2286, 203]]
    },
    {
      name: "霜風高地", width: 2340, goal: 2236, theme: "frost", supplies: [],
      platforms: [
        [0, groundY, 393], [461, groundY, 366], [898, groundY, 370],
        [1342, groundY, 389], [1799, groundY, 541],
        [106, 182, 78], [230, 150, 96], [365, 182, 85], [479, 175, 83],
        [615, 147, 101], [774, 176, 86], [920, 185, 77], [1057, 149, 107],
        [1238, 173, 93], [1366, 173, 83], [1505, 143, 96], [1663, 179, 92],
        [1831, 182, 75], [1950, 152, 88], [2098, 176, 93]
      ],
      enemies: [
        [269, 228, 338, 39, 2, groundY, "guard"], [535, 490, 584, 44, 2, 173, "wisp"],
        [687, 632, 765, 34, 2, groundY, "guard"], [966, 928, 1029, 36, 0, groundY, "beetle"],
        [1108, 1052, 1162, 45, 2, 168, "wisp"], [1217, 1170, 1238, 40, 2, groundY, "guard"],
        [1435, 1388, 1514, 42, 2, groundY, "guard"], [1561, 1516, 1610, 47, 2, 158, "wisp"],
        [1886, 1824, 1930, 46, 2, groundY, "guard"], [2008, 1955, 2055, 45, 2, 170, "wisp"],
        [2142, 2092, 2195, 39, 2, groundY, "guard"]
      ],
      gems: [[146, 165], [275, 134], [421, 166], [518, 158], [670, 131], [850, 161],
        [959, 169], [1109, 131], [1299, 156], [1409, 157], [1550, 127], [1724, 163],
        [1871, 166], [1994, 136], [2144, 160]]
    },
    {
      name: "熔火遺跡", width: 2260, goal: 2188, theme: "ruins", supplies: [],
      arena: { kind: "magma", name: "熔核巨像", start: 1732, bossX: 2011, gate: 2149 },
      platforms: [
        [0, groundY, 364], [427, groundY, 359], [856, groundY, 358],
        [1283, groundY, 340], [1690, groundY, 570],
        [118, 180, 76], [240, 149, 100], [340, 180, 69],
        [450, 177, 85], [586, 150, 105], [742, 178, 90],
        [879, 177, 87], [1016, 147, 110], [1171, 177, 88],
        [1302, 177, 90], [1451, 147, 101], [1576, 181, 78],
        [1785, 178, 77], [1908, 185, 59]
      ],
      enemies: [
        [252, 200, 334, 42, 1, groundY, "hound"], [528, 492, 583, 38, 2, groundY, "guard"],
        [680, 623, 752, 38, 1, groundY, "hound"], [924, 888, 971, 44, 2, 167, "wisp"],
        [1043, 1000, 1125, 43, 1, groundY, "hound"], [1167, 1134, 1184, 39, 2, groundY, "guard"],
        [1380, 1344, 1420, 45, 2, 169, "wisp"], [1507, 1450, 1583, 41, 1, groundY, "hound"]
      ],
      gems: [[156, 164], [289, 133], [396, 165], [492, 161], [639, 134], [808, 162],
        [928, 161], [1070, 131], [1238, 161], [1347, 161], [1500, 131], [1638, 165],
        [1825, 162], [1935, 168]]
    }
  ];

  const weapons = [
    { name: "彩虹彈", cooldown: 0.19, life: 1.05, speed: 325, spread: [0], damage: 1, hits: 1, w: 8, h: 5 },
    { name: "星花散彈", cooldown: 0.38, life: 0.44, speed: 300, spread: [-115, -56, 0, 56, 115],
      damage: 1, hits: 1, w: 6, h: 4, color: "#ffd86b" },
    { name: "晶光穿透槍", cooldown: 0.56, life: 1.12, speed: 405, spread: [0],
      damage: 3, hits: 3, w: 15, h: 7, color: "#6feaff" },
    { name: "閃電槍", kind: "lightning", artifact: true, cooldown: 0.15, damage: 3,
      range: 285, chainRange: 112, targets: 5, color: "#aadfff" },
    { name: "噴火槍", cooldown: 0.11, life: 0.24, speed: 245, spread: [-52, -19, 17], kind: "flame",
      damage: 1, hits: 1, w: 8, h: 7, color: "#ff9258" },
    { name: "火焰雷射槍", kind: "beam", artifact: true, cooldown: 0.18, damage: 2, range: 240, h: 10, color: "#ffc961" }
  ];
  const enemyTypes = {
    slime: { w: 25, h: 16, hp: 1, points: 100 },
    hopper: { w: 22, h: 21, hp: 2, points: 150 },
    bat: { w: 25, h: 15, hp: 1, points: 125 },
    beetle: { w: 27, h: 17, hp: 3, points: 220 },
    caster: { w: 22, h: 26, hp: 2, points: 200 },
    guard: { w: 29, h: 27, hp: 4, points: 290 },
    wisp: { w: 22, h: 20, hp: 3, points: 260 },
    hound: { w: 30, h: 21, hp: 4, points: 320 },
    boss: { w: 60, h: 57, hp: 180, points: 3600 }
  };

  const slimeColors = [
    ["#305552", "#4bae7f", "#78dba0", "#b9f4a6"],
    ["#684365", "#cf6e9e", "#ef99b9", "#ffd3de"],
    ["#544881", "#9278c5", "#b49bea", "#e0caff"]
  ];
  const keyActions = {
    ArrowLeft: "left", KeyA: "left", ArrowRight: "right", KeyD: "right",
    ArrowUp: "jump", KeyW: "jump", Space: "jump", KeyX: "fire", KeyJ: "fire"
  };
  const keys = new Set();
  const pointers = new Map();
  const touchButtons = [...document.querySelectorAll("[data-action]")];
  const healthLabel = document.querySelector("#health");
  const hearts = [...healthLabel.children];
  const scoreLabel = document.querySelector("#score");
  const result = document.querySelector("#result");
  const resultTitle = document.querySelector("#result-title");
  const resultDetail = document.querySelector("#result-detail");
  const replay = document.querySelector("#replay");
  const retryButton = document.querySelector("#retry-level");
  const bossHud = document.querySelector("#boss-hud");
  const bossHealth = document.querySelector("#boss-health");
  const bossWarning = document.querySelector("#boss-warning");
  const testLevel = document.querySelector("#test-level");
  let testInvincible = false, testNoCooldown = false;
  const nextButton = document.querySelector("#next-level");
  const levelNumber = document.querySelector("#level-number");
  const levelName = document.querySelector("#level-name");
  const weaponButtons = [...document.querySelectorAll("[data-weapon]")];
  const supplyMessage = document.querySelector("#supply-message");
  const announce = document.querySelector("#announce");
  const equipped = document.querySelector("#equipped");
  const weaponToggle = document.querySelector("#weapon-toggle");
  const settingsToggle = document.querySelector("#settings-toggle");
  const settingsPanel = document.querySelector("#settings-panel");
  const weaponPanel = document.querySelector("#weapon-panel");
  const restartPanel = document.querySelector("#restart-panel");
  const guidePanel = document.querySelector("#guide-panel");
  const guideTitle = document.querySelector("#guide-title");
  const guideTip = document.querySelector("#guide-tip");
  const guideStep = document.querySelector("#guide-step");
  const guideNext = document.querySelector("#advance-guide");
  const continuePanel = document.querySelector("#continue-panel");
  const bestLabel = document.querySelector("#best-score");
  const storageNotice = document.querySelector("#storage-notice");
  const stageProgress = document.querySelector("#stage-progress");
  const screen = document.querySelector("#screen");
  const bossPhase = document.querySelector("#boss-phase");
  const bossDomain = document.querySelector("#boss-domain");
  const portrait = matchMedia("(orientation: portrait) and (any-pointer: coarse) and (max-width: 600px)");
  const characterPanel = document.querySelector("#character-panel");
  const characterCancel = document.querySelector("#cancel-character");
  const characterCards = [...document.querySelectorAll("[data-character]")];
  const panels = [settingsPanel, weaponPanel, restartPanel, guidePanel, continuePanel, characterPanel];
  let restartOrigin;
  const menuOpen = () => panels.some(panel => panel.open);
  const reduceMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  let player, enemies, gems, shots, particles, camera, score, health, state;
  let time, shotIndex, jumpBuffer, previousTime, accumulator = 0;
  let levelIndex, level, platforms, pits, weaponIndex, enemyShots;
  let bricks, unlocked, arcs, unlockUntil, beam;
  let boss, stageEntry, crystalDefeat;
  let domainUnlocked = false, domainTicks = 0, domainCooldown = 0, domainNotice = false;
  const domainButton = document.querySelector("#domain-skill");
  const domainStatus = document.querySelector("#domain-status");
  const domainName = document.querySelector("#domain-name");
  const domainDuration = 4 * 60;
  const domainRecovery = 60 * 60;
  const ultimateChargeTime = 5 * 60;
  const ultimateRecovery = 120 * 60;
  const ultimateInterruptRecovery = 15 * 60;
  const ultimateDamage = 24;
  const ultimateButton = document.querySelector("#ultimate-skill");
  const ultimateStatus = document.querySelector("#ultimate-status");
  const ultimateProgress = document.querySelector("#ultimate-progress");
  let ultimateCharge = 0, ultimateCooldown = 0, ultimateOrb, ultimateSlash;
  const characters = {
    astral: {
      name: "星界術師", skill: "無限星界", ultimate: "虛空・紫星", freeze: true, bossPace: 0.50,
      pulse: 60, damage: 1, bossDamage: 1, color: "#c7c2ff",
      tip: "定住附近敵人 4 秒", backdrop: domainBackdrop, sound: sound.domain
    },
    crimson: {
      name: "赤刃咒師", skill: "赤刃神殿", ultimate: "次元斷界", freeze: false, bossPace: 0.75,
      pulse: 30, damage: 2, bossDamage: 0.5, color: "#ff8489",
      tip: "持續斬擊附近敵人 4 秒", backdrop: templeBackdrop, sound: sound.temple
    }
  };
  let characterId, activeDomain;
  const bossName = document.querySelector("#boss-name");

  function refreshDomain() {
    const seconds = testNoCooldown ? 0 : Math.ceil(domainCooldown / 60);
    const ready = domainUnlocked && domainTicks === 0 && seconds === 0;
    const label = !domainUnlocked ? "鎖定" : testNoCooldown
      ? (domainTicks > 0 ? "施放中" : "無冷卻")
      : seconds ? seconds + " 秒" : "READY";
    const { skill } = characters[characterId];
    if (domainStatus.textContent === label && domainName.textContent === skill) return;
    domainName.textContent = skill;
    domainStatus.textContent = label;
    domainButton.dataset.ready = String(ready);
    domainButton.setAttribute("aria-disabled", String(!ready));
    domainButton.title = domainUnlocked ? `K · ${skill} · ${label}` : "通過暮光菇林後解鎖";
  }

  function castDomain() {
    if (state !== "playing" || menuOpen() || !domainUnlocked || domainTicks > 0 || (!testNoCooldown && domainCooldown > 0)) return;
    activeDomain = characters[characterId];
    domainTicks = domainDuration;
    domainCooldown = domainRecovery;
    activeDomain.sound();
    if (boss && !bossHud.hidden) updateBossDomain(boss);
    refreshDomain();
    announceStatus(`領域展開 · ${activeDomain.skill}`);
    saveRun();
  }

  function inDomain(enemy) {
    return domainTicks > 0 && (Math.abs(enemy.x + enemy.w / 2 - player.x - player.w / 2) <= 320 ||
      (enemy === boss && enemy.mode !== "dormant"));
  }

  function tickDomain() {
    if (domainTicks > 0) {
      if (domainTicks % activeDomain.pulse === 1) {
        for (let i = enemies.length - 1; i >= 0; i--) {
          const enemy = enemies[i];
          if (inDomain(enemy)) {
            const damage = enemy === boss ? activeDomain.bossDamage : activeDomain.damage;
            damageEnemy(enemy, damage, activeDomain.color);
          }
        }
      }
      if (--domainTicks === 0) {
        activeDomain = null;
        refreshDomain();
        if (boss && !bossHud.hidden) updateBossDomain(boss);
      }
    }
    if (domainCooldown > 0) {
      domainCooldown--;
      if (domainCooldown % 60 === 0) {
        refreshDomain();
        pendingSave = true;
      }
    }
  }

  function refreshUltimate() {
    const charging = ultimateCharge > 0;
    const ready = !charging && ultimateCooldown === 0;
    const label = charging ? `${(Math.ceil(ultimateCharge / 6) / 10).toFixed(1)}s`
      : ready ? "READY" : `${Math.ceil(ultimateCooldown / 60)} 秒`;
    const { ultimate } = characters[characterId];
    if (ultimateStatus.textContent !== label) ultimateStatus.textContent = label;
    if (ultimateProgress.hidden !== !charging) ultimateProgress.hidden = !charging;
    if (charging) ultimateProgress.value = ultimateCharge;
    if (ultimateButton.dataset.ready !== String(ready)) {
      ultimateButton.dataset.ready = String(ready);
      ultimateButton.setAttribute("aria-disabled", String(!ready));
    }
    const title = `L · ${ultimate}`;
    if (ultimateButton.title !== title) {
      ultimateButton.title = title;
      ultimateButton.setAttribute("aria-label", `必殺技：${ultimate}`);
    }
  }

  function beginUltimate() {
    if (state !== "playing" || menuOpen() || ultimateCharge || ultimateCooldown) return;
    ultimateCharge = ultimateChargeTime;
    player.vx = clamp(player.vx, -70, 70);
    beam = null;
    arcs = [];
    sound.sustain(null);
    refreshUltimate();
    announceStatus(`${characters[characterId].ultimate} · 開始蓄力`);
    saveRun();
  }

  function cancelUltimate() {
    if (!ultimateCharge) return;
    ultimateCharge = 0;
    ultimateCooldown = ultimateInterruptRecovery;
    pendingSave = true;
    refreshUltimate();
  }

  function clearUltimate() {
    cancelUltimate();
    ultimateOrb = null;
    ultimateSlash = null;
  }

  function releaseUltimate() {
    ultimateCooldown = ultimateRecovery;
    const direction = player.facing;
    const x = player.x + (direction > 0 ? player.w : 0);
    const y = player.y + 13;
    if (characterId === "astral") {
      ultimateOrb = { x: direction > 0 ? x : x - 40, y: y - 18, w: 40, h: 36,
        vx: direction * 385, vy: 0, life: 1.45, hits: Infinity, damage: ultimateDamage,
        struck: new Set(), color: "#d69bff" };
    } else {
      ultimateSlash = { x: direction > 0 ? x : x - 300, y: y - 49,
        w: 300, h: 98, direction, life: 0.32 };
      for (let i = enemies.length - 1; i >= 0; i--) {
        const enemy = enemies[i];
        if (intersects(ultimateSlash, enemy)) damageEnemy(enemy, ultimateDamage, "#ff978c", direction);
      }
    }
    sound.ultimate(characterId === "astral");
    refreshUltimate();
    announceStatus(characters[characterId].ultimate);
    pendingSave = true;
  }

  function showDomainNotice() {
    if (!domainNotice || levelIndex !== 2) return;
    domainNotice = false;
    const { skill, tip } = characters[characterId];
    supplyMessage.textContent = `新技能解鎖！${skill} · 按 K 或點技能按鈕，${tip}。`;
    supplyMessage.hidden = false;
    unlockUntil = time + 6;
    announceStatus(supplyMessage.textContent);
  }

  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  // followX is the ordinary side-scrolling view before framing the boss arena.
  let followX, previousPlayerX, baseViewWidth, lastViewWidth;
  const portraitWidth = 352;
  const normalViewWidth = () => portrait.matches && !(reduceMotion && level.arena) ? portraitWidth : width;

  function resetCamera() {
    previousPlayerX = player.x;
    baseViewWidth = normalViewWidth();
    followX = clamp(player.x - baseViewWidth * 0.35, 0, level.width - baseViewWidth);
    camera = followX;
  }

  function frameCamera(x) {
    const rightMargin = baseViewWidth * 0.42;
    const leftMargin = baseViewWidth * 0.28;
    // The view moves only as the player pushes an edge of this horizontal band.
    followX = clamp(clamp(followX, x - rightMargin, x - leftMargin), 0, level.width - baseViewWidth);
    let viewWidth = baseViewWidth;
    camera = followX;
    if (level.arena) {
      const { start, gate } = level.arena;
      // Frame the whole arena during the approach, so the trigger itself never cuts the shot.
      const approachLength = 480;
      const entryX = start - rightMargin - approachLength;
      const approach = clamp((followX - entryX) / approachLength, 0, 1);
      const blend = approach * approach * (3 - 2 * approach);
      viewWidth += (width - viewWidth) * blend;
      const arenaX = start - 27 + Math.max(0, x - gate);
      if (approach > 0) {
        // Match the incoming scroll speed and arrive at the locked view at zero speed.
        camera = entryX + (arenaX - entryX) * blend + approachLength * approach * (1 - approach) ** 2;
      }
    }
    camera = clamp(camera, 0, level.width - viewWidth);
    if (portrait.matches && viewWidth !== lastViewWidth) {
      canvas.style.setProperty("--view-scale", `${width / viewWidth * 100}%`);
    }
    lastViewWidth = portrait.matches ? viewWidth : undefined;
  }
  const intersects = (a, b) =>
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  // A run records game state at a ground checkpoint. Account identity is never
  // part of a key or value. The server-rendered tester UI selects a separate slot.
  const slot = testLevel ? "pixel-blaster.practice." : "pixel-blaster.play.";
  function readLocal(key) {
    try { return JSON.parse(window.localStorage.getItem(slot + key)); }
    catch { return null; }
  }
  function writeLocal(key, value) {
    try { window.localStorage.setItem(slot + key, JSON.stringify(value)); }
    catch { storageNotice.hidden = false; }
  }
  const integer = (n, low, high) => Number.isSafeInteger(n) && n >= low && n <= high;
  const idsValid = (ids, count) => Array.isArray(ids) && ids.length <= count &&
    ids.every(id => integer(id, 0, count - 1)) && new Set(ids).size === ids.length;
  function readRun() {
    const r = readLocal("run");
    if (r?.v !== 1 || !integer(r.stage, 0, levels.length - 1)) return null;
    const map = levels[r.stage];
    if (!integer(r.score, 0, Number.MAX_SAFE_INTEGER) || !integer(r.base, 0, r.score) ||
        !integer(r.hp, 1, maxHealth) || !idsValid(r.guns, weapons.length) ||
        !r.guns.includes(0) || !r.guns.includes(r.weapon) ||
        !idsValid(r.picked, map.gems.length) || !idsValid(r.beaten, map.enemies.length + Number(!!map.arena)) ||
        !map.platforms.some(([x,y]) => y === groundY && Math.max(64, x + 13) === r.floor)) return null;
    return r;
  }

  const storedCharacter = readLocal("character");
  const hasCharacter = typeof storedCharacter === "string" && Object.hasOwn(characters, storedCharacter);
  characterId = hasCharacter ? storedCharacter : "astral";
  let choosingAtLaunch = !hasCharacter;

  let savedRun = readRun();
  let allowSave = false, pendingSave = false;
  let picked, beaten;
  const storedBest = readLocal("best");
  let best = integer(storedBest, 0, Number.MAX_SAFE_INTEGER) ? storedBest : 0;
  function recordBest() {
    if (score <= best) return;
    const other = readLocal("best");
    best = Math.max(score, integer(other, 0, Number.MAX_SAFE_INTEGER) ? other : 0);
    writeLocal("best", best);
    bestLabel.textContent = String(best);
  }
  function checkpoint(stage, base, hp) {
    return { v: 1, stage, base, score: base, hp, guns: [...unlocked], weapon: weaponIndex,
      domain: stage >= 2, cooldown: domainCooldown, domainNotice,
      ultimateCooldown: ultimateCharge ? ultimateInterruptRecovery : ultimateCooldown, floor: 64, picked: [], beaten: [] };
  }
  function saveRun() {
    if (!allowSave || state !== "playing") return;
    writeLocal("run", { ...checkpoint(levelIndex, stageEntry.score, health),
      score, floor: player.respawn, picked: [...picked], beaten: [...beaten] });
    pendingSave = false;
  }
  function resumeRun() {
    if (!savedRun) return;
    const r = savedRun;
    savedRun = null;
    continuePanel.close();
    allowSave = true;
    domainCooldown = integer(r.cooldown, 0, 3600) ? r.cooldown : 0;
    ultimateCooldown = integer(r.ultimateCooldown, 0, ultimateRecovery) ? r.ultimateCooldown : 0;
    domainNotice = r.stage === 2 && (r.domainNotice === true || r.domain === undefined);
    score = r.base;
    health = r.hp;
    unlocked = testLevel ? new Set(weapons.keys()) : new Set(r.guns);
    weaponIndex = r.weapon;
    startLevel(r.stage, true);
    score = r.score;
    picked = new Set(r.picked);
    beaten = new Set(r.beaten);
    gems = gems.filter(gem => !picked.has(gem.id));
    enemies = enemies.filter(enemy => !beaten.has(enemy.id));
    if (boss && beaten.has(boss.id)) boss.hp = 0;
    player.x = player.respawn = r.floor;
    resetCamera();
    updateWeapons();
    updateHud();
    updateProgress();
    saveRun();
  }

  const guideSteps = [
    ["移動", "按住左側的方向鍵，朝右邊的旗幟前進。鍵盤可用 ← → 或 A、D。"],
    ["跳躍", "點右側「跳躍」或按空白鍵。按住方向再跳，就能越過缺口。"],
    ["發射", "按住「射擊」或 X，朝面向的方向持續發射。移動和跳躍時也能射擊。"],
    ["補給磚", "站到補給磚正下方，跳起用頭頂它。新武器會自動裝備，點「切換」可查看武器清單。"]
  ];
  let guideIndex = 0;
  function drawGuide() {
    guideStep.textContent = `新手引導 · ${guideIndex + 1} / ${guideSteps.length}`;
    [guideTitle.textContent, guideTip.textContent] = guideSteps[guideIndex];
    guideNext.textContent = guideIndex === guideSteps.length - 1 ? "開始遊玩" : "下一步";
  }
  function showGuide() {
    guideIndex = 0;
    drawGuide();
    openPanel(guidePanel);
  }
  function leaveGuide() {
    guidePanel.close();
    writeLocal("guideSeen", true);
    allowSave = true;
    saveRun();
    canvas.focus({ preventScroll: true });
  }
  function updateProgress() {
    const percent = state === "cleared" || state === "won" ? 100 :
      clamp(Math.floor((player.x - 64) * 100 / (level.goal - player.w - 64)), 0, 99);
    if (stageProgress.value !== percent) stageProgress.value = percent;
  }

  function announceStatus(message) {
    announce.textContent = message;
  }

  function updateHud() {
    scoreLabel.textContent = String(score).padStart(4, "0");
    healthLabel.setAttribute("aria-label", `${health} / ${maxHealth} 點生命`);
    hearts.forEach((heart, index) => heart.classList.toggle("empty", index >= health));
  }

  function clearInputs() {
    sound.sustain(null);
    keys.clear();
    beam = null;
    arcs = [];
    for (const [id, button] of pointers) {
      if (button.hasPointerCapture(id)) button.releasePointerCapture(id);
    }
    pointers.clear();
    touchButtons.forEach(button => button.classList.remove("pressed"));
    jumpBuffer = 0;
  }

  function updateWeapons() {
    equipped.textContent = weapons[weaponIndex].name;
    weaponToggle.setAttribute("aria-label", `目前裝備${equipped.textContent}，切換武器`);
    weaponButtons.forEach((button, i) => {
      button.disabled = !unlocked.has(i);
      button.setAttribute("aria-label", `${i + 1} · ${weapons[i].name}${button.disabled ? "，尚未解鎖" : ""}`);
      button.setAttribute("aria-pressed", String(i === weaponIndex));
    });
  }

  function selectWeapon(index) {
    if (state !== "playing" || index === weaponIndex || !unlocked.has(index)) return;
    sound.sustain(null);
    weaponIndex = index;
    beam = null;
    arcs = [];
    updateWeapons();
    saveRun();
    announceStatus(`已切換至${weapons[index].name}`);
  }

  function bumpBrick(brick) {
    if (unlocked.has(brick.weapon)) return;
    sound.brick();
    unlocked.add(brick.weapon);
    brick.bump = 0.23;
    selectWeapon(brick.weapon);
    supplyMessage.textContent = `已解鎖｜${weapons[brick.weapon].name}`;
    supplyMessage.hidden = false;
    unlockUntil = time + 2.2;
    burst(brick.x + brick.w / 2, brick.y - 2, ["#fff8c4", weapons[brick.weapon].color], 15);
  }

  function startLevel(index, focus = false) {
    clearUltimate();
    clearInputs();
    levelIndex = index;
    level = levels[index];
    domainUnlocked = index >= 2;
    domainTicks = 0;
    activeDomain = null;
    crystalDefeat = null;
    sound.setTrack(level.theme);
    if (testLevel) testLevel.value = String(index);
    stageEntry = { score };
    picked = new Set();
    beaten = new Set();
    pendingSave = false;
    screen.dataset.protected = "false";
    screen.dataset.arena = "false";
    platforms = level.platforms.map(([x, y, w]) => ({ x, y, w }));
    const ground = platforms.filter(platform => platform.y === groundY);
    bricks = level.supplies.map(([x, y, weapon]) => ({ x, y, weapon, w: 25, h: 16, bump: 0 }));
    platforms.push(...bricks);
    pits = ground.slice(1).map((next, i) => [ground[i].x + ground[i].w, next.x]);
    player = { x: 64, y: groundY - 23, w: 16, h: 23, vx: 0, vy: 0, facing: 1,
      grounded: true, grace: 0, cooldown: 0, immunity: 0, respawn: 64 };
    enemies = level.enemies.map(([x, left, right, speed, color, floor = groundY, type = "slime"], index) => {
      const stats = enemyTypes[type];
      return { ...stats, id: index, maxHp: stats.hp, x, y: floor - stats.h, floor, left, right, speed, color, type,
        direction: index % 2 ? 1 : -1, phase: index * 0.73, cooldown: 0.8 + index % 3 * 0.34, flash: 0 };
    });
    boss = null;
    if (level.arena) {
      const stats = enemyTypes.boss;
      const hp = level.arena.kind === "crystal" ? 120 : stats.hp;
      boss = { ...stats, id: level.enemies.length, hp, maxHp: hp, kind: level.arena.kind, phase: 1, x: level.arena.bossX, y: groundY - stats.h,
        color: 1, type: "boss", direction: -1, flash: 0, mode: "dormant", attack: "rain",
        timer: 0, patternIndex: 0, safeOrigin: 0 };
      enemies.push(boss);
    }
    bossHud.hidden = true;
    gems = level.gems.map(([x, y], id) => ({ id, x: x - 5, y: y - 6, w: 10, h: 12 }));
    shots = [];
    enemyShots = [];
    arcs = [];
    unlockUntil = 0;
    supplyMessage.hidden = true;
    particles = [];
    resetCamera();
    shotIndex = 0;
    time = 0;
    state = "playing";
    refreshUltimate();
    refreshDomain();
    showDomainNotice();
    result.hidden = true;
    levelNumber.textContent = `LEVEL 0${index + 1}`;
    levelName.textContent = level.name;
    document.title = `Pixel Blaster｜${level.name}`;
    updateProgress();
    updateHud();
    if (focus) {
      canvas.focus({ preventScroll: true });
      announceStatus(`第 ${index + 1} 關，${level.name}`);
    }
  }

  function reset(focus = false) {
    clearUltimate();
    ultimateCooldown = 0;
    domainCooldown = 0;
    domainNotice = false;
    score = 0;
    health = maxHealth;
    unlocked = testLevel ? new Set(weapons.keys()) : new Set([0]);
    weaponIndex = 0;
    startLevel(0, focus);
    updateWeapons();
  }

  function nextLevel() {
    if (state !== "cleared") return;
    health = Math.min(maxHealth, health + 1);
    startLevel(levelIndex + 1, true);
    saveRun();
  }

  function retryLevel() {
    if (state !== "lost") return;
    score = stageEntry.score;
    health = maxHealth;
    startLevel(levelIndex, true);
    updateWeapons();
    saveRun();
  }

  function held(action) {
    for (const code of keys) {
      if (keyActions[code] === action) return true;
    }
    for (const button of pointers.values()) {
      if (button.dataset.action === action) return true;
    }
    return false;
  }

  window.addEventListener("keydown", event => {
    if (menuOpen() || event.ctrlKey || event.altKey || event.metaKey || event.target.closest?.("select, a")) return;
    if (event.code === "KeyL") {
      event.preventDefault();
      if (!event.repeat) { sound.unlock(); beginUltimate(); }
      return;
    }
    if (event.code === "KeyK") {
      event.preventDefault();
      if (!event.repeat) { sound.unlock(); castDomain(); }
      return;
    }
    if (event.code === "KeyR" && !event.repeat) {
      sound.unlock();
      requestRestart();
      return;
    }
    if (/^(Digit|Numpad)[1-6]$/.test(event.code)) {
      event.preventDefault();
      sound.unlock();
      if (!event.repeat) selectWeapon(Number(event.code.slice(-1)) - 1);
      return;
    }
    const action = keyActions[event.code];
    if (!action || state !== "playing") return;
    if (event.code === "Space" && event.target.closest?.("button")) return;
    if (event.target.closest?.("button")) canvas.focus({ preventScroll: true });
    event.preventDefault();
    sound.unlock();
    if (event.repeat && !keys.has(event.code)) return;
    if (action === "jump" && !keys.has(event.code)) jumpBuffer = 0.13;
    keys.add(event.code);
  });

  window.addEventListener("keyup", event => keys.delete(event.code));
  window.addEventListener("blur", () => { sound.setActive(false); clearInputs(); });
  window.addEventListener("focus", () => sound.setActive(true));
  document.addEventListener("visibilitychange", () => {
    sound.setActive(!document.hidden);
    if (document.hidden) clearInputs();
  });

  window.addEventListener("pagehide", () => { clearInputs(); saveRun(); });
  window.addEventListener("orientationchange", clearInputs);

  function releaseTouch(event) {
    const button = pointers.get(event.pointerId);
    if (!button) return;
    pointers.delete(event.pointerId);
    button.classList.toggle("pressed", [...pointers.values()].includes(button));
    if (event.type === "pointercancel" && button.dataset.action === "jump" && !held("jump")) jumpBuffer = 0;
  }
  for (const button of touchButtons) {
    button.addEventListener("pointerdown", event => {
      if (event.button !== 0 || state !== "playing" || menuOpen()) return;
      event.preventDefault();
      sound.unlock();
      // Window-level release also covers browsers that lose capture during rotation.
      if (button.isConnected) button.setPointerCapture(event.pointerId);
      pointers.set(event.pointerId, button);
      button.classList.add("pressed");
      if (button.dataset.action === "jump") jumpBuffer = 0.13;
      if (button.dataset.action === "domain") castDomain();
      if (button.dataset.action === "ultimate") beginUltimate();
    });

    button.addEventListener("pointerup", event => { sound.unlock(); releaseTouch(event); });
    button.addEventListener("pointercancel", releaseTouch);
    button.addEventListener("lostpointercapture", event => {
      if (pointers.get(event.pointerId) === button) releaseTouch(event);
    });
    button.addEventListener("contextmenu", event => event.preventDefault());
  }
  ultimateButton.addEventListener("click", event => {
    if (event.detail === 0) { sound.unlock(); beginUltimate(); }
  });
  domainButton.addEventListener("click", event => {
    if (event.detail === 0) { sound.unlock(); castDomain(); }
  });
  window.addEventListener("pointerup", releaseTouch);
  window.addEventListener("pointercancel", releaseTouch);

  function openPanel(panel) {
    clearInputs();
    for (const other of panels) if (other.open) other.close();
    panel.showModal();
  }
  function requestRestart() {
    restartOrigin = continuePanel.open ? continuePanel : settingsPanel.open ? settingsPanel : null;
    openPanel(restartPanel);
  }
  function cancelRestart() {
    restartPanel.close();
    if (restartOrigin) openPanel(restartOrigin);
  }
  guideNext.addEventListener("click", () => {
    if (guideIndex === guideSteps.length - 1) leaveGuide();
    else { guideIndex++; drawGuide(); }
  });
  document.querySelector("#skip-guide").addEventListener("click", leaveGuide);
  document.querySelector("#show-guide").addEventListener("click", showGuide);
  guidePanel.addEventListener("cancel", event => { event.preventDefault(); leaveGuide(); });
  continuePanel.addEventListener("cancel", event => { event.preventDefault(); resumeRun(); });
  document.querySelector("#continue-game").addEventListener("click", resumeRun);
  document.querySelector("#new-game").addEventListener("click", requestRestart);
  settingsToggle.addEventListener("click", () => openPanel(settingsPanel));

  function showCharacters() {
    characterCancel.hidden = choosingAtLaunch;
    for (const card of characterCards) {
      const selected = card.dataset.character === characterId;
      card.querySelector(".current-character").hidden = !selected || choosingAtLaunch;
    }
    openPanel(characterPanel);
    characterCards.find(card => card.dataset.character === characterId)?.focus();
  }

  function cancelCharacter() {
    if (!choosingAtLaunch) openPanel(settingsPanel);
  }
  document.querySelector("#change-character").addEventListener("click", showCharacters);
  characterCancel.addEventListener("click", cancelCharacter);
  characterPanel.addEventListener("cancel", event => {
    event.preventDefault();
    cancelCharacter();
  });
  for (const card of characterCards) {
    card.addEventListener("click", () => {
      const nextCharacter = card.dataset.character;
      if (characterId !== nextCharacter) clearUltimate();
      characterId = nextCharacter;
      refreshUltimate();
      if (pendingSave) saveRun();
      writeLocal("character", characterId);
      characterPanel.close();
      refreshDomain();
      announceStatus(`已選擇${characters[characterId].name}`);
      if (choosingAtLaunch) {
        choosingAtLaunch = false;
        beginAdventure();
      } else {
        canvas.focus({ preventScroll: true });
      }
    });
  }
  weaponToggle.addEventListener("click", () => openPanel(weaponPanel));
  for (const close of document.querySelectorAll("[data-close]")) {
    close.addEventListener("click", () => close.closest("dialog").close());
  }
  for (const panel of panels) {
    panel.addEventListener("click", event => {
      if (event.target !== panel) return;
      const box = panel.getBoundingClientRect();
      if (event.clientX >= box.left && event.clientX <= box.right &&
          event.clientY >= box.top && event.clientY <= box.bottom) return;
      if (panel === continuePanel || panel === guidePanel || panel === characterPanel) return;
      if (panel === restartPanel) cancelRestart();
      else panel.close();
    });
  }
  restartPanel.addEventListener("cancel", event => { event.preventDefault(); cancelRestart(); });
  document.querySelector("#restart").addEventListener("click", requestRestart);
  replay.addEventListener("click", requestRestart);
  document.querySelector("#cancel-restart").addEventListener("click", cancelRestart);
  document.querySelector("#confirm-restart").addEventListener("click", () => {
    restartPanel.close();
    savedRun = null;
    allowSave = true;
    reset(true);
    saveRun();
  });
  if (testLevel) {
    for (const [id, label, toggle] of [
      ["test-invincible", "無敵", () => (testInvincible = !testInvincible)],
      ["test-domain-cooldown", "領域無冷卻", () => (testNoCooldown = !testNoCooldown)]
    ]) {
      const button = document.querySelector("#" + id);
      button?.addEventListener("click", () => {
        const enabled = toggle();
        button.setAttribute("aria-pressed", String(enabled));
        button.textContent = `${label}｜${enabled ? "開" : "關"}`;
        refreshDomain();
      });
    }
    levels.forEach((level, index) => testLevel.add(new Option(`${index + 1} · ${level.name}`, String(index))));
    testLevel.addEventListener("change", () => {
      const index = Number(testLevel.value);
      if (!Number.isInteger(index) || !levels[index]) return;
      health = maxHealth;
      score = 0;
      if (settingsPanel.open) settingsPanel.close();
      startLevel(index, true);
      saveRun();
    });
  }
  window.addEventListener("pageshow", event => {
    if (event.persisted && document.querySelector(".account-panel")) location.reload();
  });
  nextButton.addEventListener("click", nextLevel);
  retryButton.addEventListener("click", retryLevel);
  weaponButtons.forEach((button, index) => {
    button.addEventListener("click", () => {
      selectWeapon(index);
      if (weaponPanel.open) weaponPanel.close();
      if (state === "playing") canvas.focus({ preventScroll: true });
    });
  });
  document.addEventListener("click", sound.unlock);
  canvas.tabIndex = -1;

  function finish(won) {
    clearUltimate();
    const more = won && levelIndex + 1 < levels.length;
    if (won && levelIndex === 1) domainNotice = true;
    state = more ? "cleared" : won ? "won" : "lost";
    clearInputs();
    sound.setTrack(null);
    sound.finish(won);
    resultTitle.textContent = more ? `${level.name}通過！` : won ? "五關全破！" : "冒險暫告一段落";
    resultDetail.textContent = more
      ? `累計 ${score} 分 · 下一關 ${levels[levelIndex + 1].name}`
      : `本次分數 ${score}`;
    updateProgress();
    if (allowSave) {
      const next = more ? levelIndex + 1 : levelIndex;
      const nextSave = checkpoint(next, more ? score : stageEntry.score, more ? Math.min(maxHealth, health + 1) : maxHealth);
      if (state === "won") nextSave.completed = true;
      writeLocal("run", nextSave);
    }
    pendingSave = false;
    retryButton.hidden = won;
    replay.hidden = more || (!won && levelIndex === 0);
    nextButton.hidden = !more;
    result.hidden = false;
    resultDetail.textContent += ` · 最高分 ${best}`;
    resultTitle.focus({ preventScroll: true });
  }

  function earn(points) {
    score += points;
    recordBest();
    pendingSave = true;
    updateHud();
  }

  function burst(x, y, colors, count = 8) {
    if (reduceMotion) count = Math.min(3, count);
    for (let index = 0; index < count; index++) {
      const angle = index / count * Math.PI * 2;
      const speed = 28 + Math.random() * 63;
      particles.push({
        x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 18,
        life: 0.24 + Math.random() * 0.24, color: colors[index % colors.length]
      });
    }
  }

  function respawnPlayer() {
    Object.assign(player, { x: player.respawn, y: groundY - player.h, vx: 0,
      vy: 0, grounded: true, grace: 0 });
    resetCamera();
  }

  function hurt(enemy) {
    if (state !== "playing" || (enemy && player.immunity > 0)) return;
    if (testInvincible) {
      if (!enemy) respawnPlayer();
      return;
    }
    const interrupted = ultimateCharge > 0;
    cancelUltimate();
    health--;
    pendingSave = true;
    updateHud();
    announceStatus(`${interrupted ? "蓄力中斷 · " : ""}剩餘 ${health} 點生命`);
    if (health === 0) {
      finish(false);
      return;
    }
    sound.hurt();
    player.immunity = 1.25;
    screen.dataset.protected = "true";
    if (enemy) {
      player.vx = player.x < enemy.x ? -110 : 110;
      player.vy = -118;
      player.grounded = false;
      player.grace = 0;
      burst(player.x + 8, player.y + 10, ["#ff83aa", "#fff1c7"]);
    } else {
      respawnPlayer();
    }
  }

  function update(dt) {
    if (ultimateCooldown > 0 && --ultimateCooldown % 60 === 0) {
      refreshUltimate();
      pendingSave = true;
    }
    previousPlayerX = player.x;
    time += dt;
    const movement = Number(held("right")) - Number(held("left"));
    if (movement) player.facing = movement;
    const targetSpeed = movement * (ultimateCharge > 0 ? 70 : 140);
    player.vx += clamp(targetSpeed - player.vx, -1500 * dt, 1500 * dt);
    player.cooldown = Math.max(0, player.cooldown - dt);
    if (player.immunity > 0) {
      player.immunity = Math.max(0, player.immunity - dt);
      if (!player.immunity) screen.dataset.protected = "false";
    }
    player.grace = player.grounded ? 0.08 : Math.max(0, player.grace - dt);

    if (jumpBuffer > 0 && player.grace > 0) {
      sound.jump();
      player.vy = -300;
      player.grounded = false;
      player.grace = 0;
      jumpBuffer = 0;
      burst(player.x + 8, player.y + player.h, ["#fff4cf", "#a5eb9a"], 5);
    }
    jumpBuffer = Math.max(0, jumpBuffer - dt);

    const rightEdge = boss?.hp > 0 ? level.arena.gate : level.width - 1;
    const arenaActive = boss?.hp > 0 && boss.mode !== "dormant";
    const leftEdge = arenaActive ? level.arena.start : 1;
    player.x = clamp(player.x + player.vx * dt, leftEdge, rightEdge - player.w);
    const oldTop = player.y;
    const oldBottom = oldTop + player.h;
    player.vy = Math.min(player.vy + 780 * dt, 450);
    player.y += player.vy * dt;
    player.grounded = false;
    if (player.vy < 0) {
      const brick = bricks.find(brick => {
        const bottom = brick.y + brick.h;
        return player.x + player.w > brick.x && player.x < brick.x + brick.w &&
          oldTop >= bottom && player.y <= bottom;
      });
      if (brick) {
        player.y = brick.y + brick.h;
        player.vy = 0;
        bumpBrick(brick);
      }
    } else {
      let landing = null;
      for (const platform of platforms) {
        if (player.x + player.w > platform.x && player.x < platform.x + platform.w &&
            oldBottom <= platform.y && player.y + player.h >= platform.y &&
            (!landing || platform.y < landing.y)) {
          landing = platform;
        }
      }
      if (landing) {
        player.y = landing.y - player.h;
        player.vy = 0;
        player.grounded = true;
        if (landing.y === groundY) {
          const floor = Math.max(64, landing.x + 13);
          if (floor !== player.respawn) pendingSave = true;
          player.respawn = floor;
        }
      }
    }

    if (player.y > height + 20) {
      hurt(null);
      if (state !== "playing") return;
    }

    enemies.forEach(enemy => updateEnemy(enemy, dt));
    tickDomain();
    if (crystalDefeat) crystalDefeat.life -= dt;
    updateWeapon();
    shots = shots.filter(shot => advanceShot(shot, dt));
    if (ultimateOrb && !advanceShot(ultimateOrb, dt)) ultimateOrb = null;
    if (ultimateSlash && (ultimateSlash.life -= dt) <= 0) ultimateSlash = null;
    enemyShots = enemyShots.filter(shot => {
      if (!moveShot(shot, dt)) return false;
      if (shot.delay > 0 || !intersects(player, shot)) return true;
      hurt(shot);
      return false;
    });
    if (state !== "playing") return;

    gems = gems.filter(gem => {
      if (!intersects(player, gem)) return true;
      burst(gem.x + 5, gem.y + 6, ["#fff6be", "#ffae54", "#fa6ca5"]);
      sound.gem();
      picked.add(gem.id);
      earn(25);
      return false;
    });

    const contact = enemies.find(enemy => intersects(player, enemy));
    if (contact) hurt(contact);
    if (ultimateCharge > 0) {
      if (--ultimateCharge === 0) releaseUltimate();
      else refreshUltimate();
    }
    if (state === "playing" && !(boss?.hp > 0) && player.x + player.w >= level.goal && player.y + player.h >= groundY - 57) {
      finish(true);
    }

    for (const particle of particles) {
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vy += 105 * dt;
    }
    particles = particles.filter(particle => particle.life > 0);
    for (const brick of bricks) brick.bump = Math.max(0, brick.bump - dt);
    updateSupplyMessage();
    updateProgress();
    if (pendingSave) saveRun();
  }

  function updateSupplyMessage() {
    if (time < unlockUntil) return;
    const nearby = bricks.find(brick => !unlocked.has(brick.weapon) &&
      Math.abs(player.x + player.w / 2 - brick.x - brick.w / 2) < 74);
    supplyMessage.hidden = !nearby;
    if (nearby) {
      supplyMessage.textContent = weapons[nearby.weapon].artifact
        ? `頂開神器磚，解鎖${weapons[nearby.weapon].name}`
        : "從磚頭下方跳起，解鎖武器";
    }
  }

  function updateWeapon() {
    beam = null;
    arcs = [];
    const firing = !ultimateCharge && held("fire");
    const weapon = weapons[weaponIndex];
    const continuous = weapon.kind === "beam" || weapon.kind === "lightning";
    sound.sustain(firing && continuous ? weapon.kind : null);
    if (!firing) return;
    if (weapon.kind === "beam") {
      updateBeam(weapon);
    } else if (weapon.kind === "lightning") {
      dischargeLightning(weapon);
    } else if (player.cooldown === 0) {
      fireWeapon();
    }
  }

  function updateBeam(weapon) {
    const start = player.x + (player.facing > 0 ? player.w : 0);
    const end = clamp(start + player.facing * weapon.range, 0, level.width);
    beam = { x: Math.min(start, end), y: player.y + 17 - weapon.h / 2,
      w: Math.abs(end - start), h: weapon.h, end };
    if (player.cooldown > 0) return;
    player.cooldown = weapon.cooldown;
    for (let index = enemies.length - 1; index >= 0; index--) {
      const enemy = enemies[index];
      if (intersects(beam, enemy)) damageEnemy(enemy, weapon.damage, weapon.color, player.facing);
    }
  }

  function fireWeapon() {
    const weapon = weapons[weaponIndex];
    sound.shot(weaponIndex);
    const color = weapon.color ?? shotColors[shotIndex++ % shotColors.length];
    for (const vy of weapon.spread) {
      shots.push({
        x: player.x + (player.facing === 1 ? player.w : -weapon.w), y: player.y + 17 - weapon.h / 2,
        w: weapon.w, h: weapon.h, vx: player.facing * weapon.speed, vy,
        life: weapon.life, damage: weapon.damage, hits: weapon.hits, kind: weapon.kind, color, struck: new Set()
      });
    }
    player.cooldown = weapon.cooldown;
  }

  function updateEnemy(enemy, dt) {
    enemy.flash = Math.max(0, enemy.flash - dt);
    if (enemy.type === "boss") {
      const attacking = enemy.mode === "windup" || enemy.mode === "recover";
      updateBoss(enemy, dt * (attacking && inDomain(enemy) ? activeDomain.bossPace : 1));
      return;
    }
    if (activeDomain?.freeze && inDomain(enemy)) {
      enemy.frozenTime = (enemy.frozenTime || 0) + dt;
      return;
    }
    const enemyTime = time - (enemy.frozenTime || 0);
    if (enemy.type === "wisp" && Math.abs(player.x - enemy.x) < 218) {
      enemy.cooldown = Math.max(0, enemy.cooldown - dt);
      if (enemy.cooldown === 0) {
        fireEnemyFan(enemy, [-0.26, 0, 0.26], 126, "#a7f5ff");
        enemy.cooldown = 2.3;
      }
    }
    if (enemy.type === "caster") {
      const dx = player.x + player.w / 2 - enemy.x - enemy.w / 2;
      if (Math.abs(dx) > 205) return;
      enemy.direction = Math.sign(dx) || enemy.direction;
      enemy.cooldown -= dt;
      if (enemy.cooldown > 0) return;
      const y = enemy.y + 9;
      const dy = player.y + player.h / 2 - y;
      const distance = Math.max(1, Math.hypot(dx, dy));
      enemyShots.push({ x: enemy.x + enemy.w / 2 - 3, y, w: 7, h: 7,
        vx: dx / distance * 105, vy: dy / distance * 105, life: 2.7, color: "#fa81cd" });
      enemy.cooldown = 1.95;
      return;
    }

    let pace = 1;
    if (enemy.type === "guard") {
      enemy.braced = (enemyTime + enemy.phase) % 2.8 < 1.35;
      pace = enemy.braced ? 0.65 : 1.35;
    }
    if (enemy.type === "hound") {
      const charge = (enemyTime + enemy.phase) % 2.65;
      enemy.windup = charge < 0.5;
      pace = enemy.windup ? 0 : charge < 1.08 ? 2.9 : 0.8;
    }
    enemy.x += enemy.direction * enemy.speed * pace * dt;
    if (enemy.x <= enemy.left || enemy.x >= enemy.right) {
      enemy.x = clamp(enemy.x, enemy.left, enemy.right);
      enemy.direction *= -1;
    }
    const baseline = enemy.floor - enemy.h;
    if (enemy.type === "bat") enemy.y = baseline + Math.sin(enemyTime * 4 + enemy.phase) * 17;
    if (enemy.type === "wisp") enemy.y = baseline + Math.sin(enemyTime * 3 + enemy.phase) * 20;
    if (enemy.type === "hopper") {
      const hop = (enemyTime + enemy.phase) % 1.48;
      enemy.y = baseline - (hop < 0.69 ? Math.sin(hop / 0.69 * Math.PI) * 34 : 0);
    }
  }

  function fireEnemyFan(enemy, offsets, speed, color) {
    const x = enemy.x + enemy.w / 2;
    const y = enemy.y + enemy.h / 2;
    const aim = Math.atan2(player.y + player.h / 2 - y, player.x + player.w / 2 - x);
    for (const offset of offsets) {
      const angle = aim + offset;
      enemyShots.push({ x: x - 4, y: y - 4, w: 8, h: 8,
        vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, life: 2.7, color });
    }
  }

  function fireGroundWave(enemy, speed) {
    const direction = enemy.direction;
    enemyShots.push({ x: direction < 0 ? enemy.x - 15 : enemy.x + enemy.w,
      y: groundY - 12, w: 15, h: 12, vx: direction * speed, vy: 0,
      life: 2.55, color: "#ffb571", kind: "wave" });
  }

  const bossPatterns = ["rain", "curtain", "rain", "volley"];
  const bossCues = { rain: "熔星雨 · 移入青帶", curtain: "彈牆 · 跳入缺口", volley: "星環 · 閃開地波" };
  const finalPatterns = ["crossfire", "curtain", "volley", "rain"];
  const crystalPatterns = ["seeker", "lattice", "quake"];
  Object.assign(bossCues, {
    seeker: "引晶追跡 · 待晶彈靠近再換向",
    lattice: "斜晶星陣 · 移入薄荷色光帶",
    quake: "雙重地鳴 · 跳過兩道震波",
    crossfire: "熔雨與地波 · 在青帶內跳躍"
  });
  const laneSpacing = 168;

  function prepareBarrage(enemy) {
    const patterns = enemy.kind === "crystal" ? crystalPatterns : enemy.phase === 2 ? finalPatterns : bossPatterns;
    enemy.attack = patterns[enemy.patternIndex % patterns.length];
    sound.warning(enemy.attack);
    enemy.mode = "windup";
    enemy.timer = enemy.kind === "crystal" ? 1.08 : enemy.phase === 2 ? 0.92 : 1.38;
    // Keep the announced lanes fixed while the player moves to safety.
    enemy.safeOrigin = player.x + player.w / 2 + laneSpacing / 2;
    enemy.laneHalfWidth = enemy.kind === "crystal" ? 38 : enemy.phase === 2 ? 30 : 42;
  }

  function rainLanes(enemy) {
    const halfWidth = enemy.laneHalfWidth;
    const { start, gate } = level.arena;
    const lanes = [];
    let center = enemy.safeOrigin + Math.floor((start - enemy.safeOrigin) / laneSpacing) * laneSpacing;
    for (; center - halfWidth <= gate; center += laneSpacing) {
      if (center + halfWidth >= start) lanes.push([center - halfWidth, center + halfWidth]);
    }
    return lanes;
  }

  function emitBarrage(enemy, enraged) {
    const { start, gate } = level.arena;
    if (enemy.attack === "rain" || enemy.attack === "crossfire") {
      const lanes = rainLanes(enemy);
      const rows = enraged ? 6 : 3;
      for (let row = 0; row < rows; row++) {
        for (let x = start - 12 + row % 2 * 7; x <= gate + 8; x += 14) {
          if (lanes.some(([left, right]) => x + 6 >= left && x <= right)) continue;
          enemyShots.push({ x, y: 6 + row * 16, w: 6, h: 8, vx: 0, vy: enraged ? 215 : 185,
            life: 1.6, kind: "rain", color: "#ffab72" });
        }
      }
      if (enemy.attack === "crossfire") fireGroundWave(enemy, 165);
    } else if (enemy.attack === "curtain") {
      // A horizontal opening at jumping height also intersects the low platforms.
      for (let column = 0; column < (enraged ? 4 : 2); column++) {
        for (let y = 5 + column % 2 * 6; y < groundY; y += 13) {
          if (y + 6 >= 146 && y <= 188) continue;
          enemyShots.push({ x: gate + 24 + column * 13, y, w: 6, h: 6,
            vx: enraged ? -205 : -185, vy: 0, life: 2.9, color: "#f5a4e8", kind: "curtain" });
        }
      }
    } else {
      const count = enraged ? 32 : 16;
      const angles = Array.from({length: count}, (_, i) => i * Math.PI * 2 / count);
      fireEnemyFan(enemy, angles, enraged ? 178 : 148, "#ffbd80");
      fireGroundWave(enemy, enraged ? 190 : 160);
    }
  }

  function emitCrystalAttack(enemy) {
    const { start, gate } = level.arena;
    if (enemy.attack === "seeker") {
      const x = enemy.x + enemy.w / 2, y = enemy.y + 16;
      const aim = Math.atan2(player.y + 10 - y, player.x + 8 - x);
      for (const offset of [-0.48, 0, 0.48]) {
        const angle = aim + offset;
        enemyShots.push({ x, y, w: 8, h: 8, vx: Math.cos(angle) * 126, vy: Math.sin(angle) * 126,
          steer: 0.65, life: 3, color: "#a6f8fc", kind: "seeker" });
      }
    } else if (enemy.attack === "lattice") {
      const lanes = rainLanes(enemy);
      for (let row = 0; row < 3; row++) {
        for (let x = start - 8 + (row % 2) * 11; x < gate + 10; x += 22) {
          if (lanes.some(([l,r]) => x + 25 >= l && x - 19 <= r)) continue;
          enemyShots.push({ x, y: 3 + row * 18, w: 7, h: 10, vx: row % 2 ? -14 : 14,
            vy: 167, life: 1.65, color: "#acddff", kind: "shard" });
        }
      }
    } else {
      for (const delay of [0, 0.84]) {
        for (const dir of [-1, 1]) {
          enemyShots.push({ x: enemy.x + enemy.w / 2, y: groundY - 13, w: 14, h: 13,
            vx: dir * 177, vy: 0, delay, life: 2.7, color: "#a2fbe4", kind: "wave" });
        }
      }
    }
  }

  function updateBoss(enemy, dt) {
    const crystal = enemy.kind === "crystal";
    if (enemy.mode === "dormant") {
      if (player.x < level.arena.start) return;
      screen.dataset.arena = "true";
      sound.setTrack(crystal ? "crystalBoss" : "boss");
      if (crystal) {
        enemy.mode = "intro";
        enemy.timer = 1.15;
        sound.crystalEnter();
      } else prepareBarrage(enemy);
      bossName.textContent = level.arena.name;
      bossHealth.max = enemy.maxHp;
      bossHud.hidden = false;
      announceStatus(level.arena.name + "出現，終點封印啟動");
    }
    enemy.direction = player.x + player.w / 2 < enemy.x + enemy.w / 2 ? -1 : 1;
    enemy.timer -= dt;
    if (enemy.timer <= 0) {
      if (enemy.mode === "windup") {
        if (crystal) emitCrystalAttack(enemy);
        else { sound.barrage(); emitBarrage(enemy, enemy.phase === 2); }
        enemy.mode = "recover";
        enemy.timer = crystal ? 1.75 : enemy.phase === 2 ? 0.70 : 2.05;
      } else if (enemy.mode === "recover" && enemy.phase === 2 &&
          (enemy.attack === "crossfire" || enemy.attack === "volley")) {
        enemy.mode = "open";
        enemy.timer = 2.15;
      } else {
        if (enemy.mode !== "intro" && enemy.mode !== "transition") enemy.patternIndex++;
        prepareBarrage(enemy);
      }
    }
    updateBossHud(enemy);
  }

  function updateBossDomain(enemy) {
    const affected = enemy.hp > 0 && enemy.mode !== "dormant" && inDomain(enemy);
    bossDomain.hidden = !affected;
    if (affected) {
      const percent = Math.round((1 - activeDomain.bossPace) * 100);
      const label = `領域影響 · 出招減速 ${percent}%`;
      if (bossDomain.textContent !== label) bossDomain.textContent = label;
    }
  }

  function updateBossHud(enemy) {
    updateBossDomain(enemy);
    bossHealth.value = Math.max(0, enemy.hp);
    let phase, warning;
    if (enemy.mode === "intro") {
      phase = "守護者甦醒"; warning = "結晶正在聚合";
    } else if (enemy.mode === "transition") {
      phase = "第二階段"; warning = "WARNING — FINAL PHASE";
    } else if (enemy.mode === "open") {
      phase = "核心露出"; warning = "瞄準巨像，立即攻擊！";
    } else {
      phase = enemy.kind === "crystal" ? "星砂晶陣" : enemy.phase === 2 ? "暴走 · 核心封閉" : "第一階段";
      warning = bossCues[enemy.attack];
    }
    if (bossPhase.textContent !== phase) bossPhase.textContent = phase;
    if (bossHud.dataset.mode !== enemy.mode) bossHud.dataset.mode = enemy.mode;
    if (bossWarning.textContent !== warning) bossWarning.textContent = warning;
  }

  function barrageGuide() {
    if (boss.mode !== "windup" && boss.mode !== "recover") return;
    if (boss.attack === "rain" || boss.attack === "crossfire" || boss.attack === "lattice") {
      for (const [left, right] of rainLanes(boss)) {
        rect(left, 0, right - left, groundY, "#76ffe31c");
        rect(left, 90, 1, groundY - 90, "#8ef4d9");
        rect(right, 90, 1, groundY - 90, "#8ef4d9");
        rect(left + 1, groundY - 3, right - left - 1, 3, "#93ffe3");
        const mid = (left + right) / 2;
        rect(mid - 4, groundY - 13, 9, 2, "#a6ffe5");
        rect(mid - 2, groundY - 11, 5, 2, "#a6ffe5");
      }
    } else if (boss.attack === "quake") {
      rect(level.arena.start, groundY - 2, level.arena.gate - level.arena.start, 2, "#a3f2d8");
    } else if (boss.attack === "curtain") {
      rect(level.arena.gate - 2, 146, 4, 43, "#98fcdc");
      for (let i = 0; i < 4; i++) rect(level.arena.gate - 10 - i * 13, 168, 6, 1, "#a4ffe6");
    }
  }

  function moveShot(shot, dt) {
    if (shot.delay > 0) { shot.delay -= dt; return true; }
    if (shot.steer > 0) {
      const aim = Math.atan2(player.y + 11 - shot.y, player.x + 8 - shot.x);
      const heading = Math.atan2(shot.vy, shot.vx);
      const delta = Math.atan2(Math.sin(aim - heading), Math.cos(aim - heading));
      const angle = heading + clamp(delta, -1.1 * dt, 1.1 * dt);
      shot.vx = Math.cos(angle) * 126;
      shot.vy = Math.sin(angle) * 126;
      shot.steer -= dt;
    }
    shot.x += shot.vx * dt;
    shot.y += shot.vy * dt;
    shot.life -= dt;
    return shot.life > 0 && shot.x >= -20 && shot.x <= level.width &&
      shot.y >= -20 && shot.y <= height;
  }

  function damageEnemy(enemy, damage, color, direction = 0) {
    const guarded = enemy.type === "guard" && enemy.braced && direction === -enemy.direction;
    if (enemy.hp <= 0 || enemy.mode === "dormant" || enemy.mode === "intro") return;
    if (guarded || (enemy.type === "boss" && enemy.phase === 2 && enemy.mode !== "open")) {
      burst(enemy.x + enemy.w / 2, enemy.y + enemy.h / 2, ["#bcddf2", "#fff5c8"], 3);
      return;
    }
    if (enemy.kind === "crystal") sound.crystalHit();
    else sound.hit();
    enemy.hp = Math.max(0, enemy.hp - damage);
    if (enemy.kind === "magma" && enemy.phase === 1 && enemy.hp <= 90) {
      enemy.hp = 90;
      enemy.phase = 2;
      enemy.mode = "transition";
      enemy.timer = 1.65;
      enemy.patternIndex = 0;
      enemyShots = [];
      sound.phaseShift();
      sound.setTrack("finalPhase");
      announceStatus("WARNING — FINAL PHASE · 核心只在組合攻擊後露出");
    }
    enemy.flash = 0.14;
    const defeated = enemy.hp <= 0;
    burst(enemy.x + enemy.w / 2, enemy.y + 6,
      [slimeColors[enemy.color][2], color, "#fff5c8"], defeated ? 14 : 4);
    if (defeated) {
      beaten.add(enemy.id);
      enemies.splice(enemies.indexOf(enemy), 1);
      earn(enemy.points);
    }
    if (enemy.type === "boss") {
      updateBossHud(enemy);
      if (defeated) {
        enemyShots = [];
        sound.setTrack(level.theme);
        bossHud.hidden = true;
        screen.dataset.arena = "false";
        if (enemy.kind === "crystal") {
          crystalDefeat = { x: enemy.x + enemy.w / 2, y: enemy.y + enemy.h / 2, life: 0.95 };
          sound.crystalDefeat();
        }
        announceStatus(level.arena.name + "已擊敗，終點封印解除");
      }
    }
  }

  function dischargeLightning(weapon) {
    let x = player.x + (player.facing > 0 ? player.w : 0);
    let y = player.y + 17;
    const hit = new Set();
    const pulse = player.cooldown === 0;
    for (let hop = 0; hop < weapon.targets; hop++) {
      let nearest;
      let range = hop === 0 ? weapon.range : weapon.chainRange;
      for (const enemy of enemies) {
        if (hit.has(enemy) || enemy.mode === "dormant") continue;
        const dx = enemy.x + enemy.w / 2 - x;
        const dy = enemy.y + enemy.h / 2 - y;
        if (hop === 0 && (dx * player.facing < -3 || Math.abs(dy) > 68)) continue;
        const distance = Math.hypot(dx, dy);
        if (distance <= range) {
          range = distance;
          nearest = enemy;
        }
      }
      if (!nearest) {
        if (hop === 0) arcs.push({ x, y, toX: clamp(x + player.facing * weapon.range, 0, level.width), toY: y });
        break;
      }
      const toX = nearest.x + nearest.w / 2;
      const toY = nearest.y + nearest.h / 2;
      arcs.push({ x, y, toX, toY });
      hit.add(nearest);
      if (pulse) damageEnemy(nearest, weapon.damage, weapon.color, Math.sign(toX - x));
      x = toX;
      y = toY;
    }
    if (pulse) player.cooldown = weapon.cooldown;
  }

  function advanceShot(shot, dt) {
    if (!moveShot(shot, dt)) return false;
    for (let i = enemies.length - 1; i >= 0; i--) {
      const enemy = enemies[i];
      if (shot.struck.has(enemy) || !intersects(shot, enemy)) continue;
      shot.struck.add(enemy);
      damageEnemy(enemy, shot.damage, shot.color, Math.sign(shot.vx));
      if (--shot.hits === 0) return false;
    }
    return true;
  }

  const sceneryPalettes = {
    grove: {
      "#80d0f3": "#8b78b5", "#8dd9f6": "#ad89b7", "#a9e4f8": "#e1a6ae",
      "#ffe590": "#ffd1a0", "#fff1ad": "#ffe6bd", "#ffd579": "#ffb992",
      "#c9edfb": "#d7a3c4", "#e8f9ff": "#f0b9c9", "#f8fdff": "#f9cdcf",
      "#a2a7df": "#8d73ab", "#8f9bd7": "#766499", "#e0eefc": "#d0a2c3",
      "#9cddaa": "#7bb596", "#a9e5af": "#89c39e", "#70cc9d": "#539e86", "#7bd3a0": "#62a990",
      "#88566a": "#593d64", "#bb796d": "#936683", "#d28c72": "#ad7b93", "#a36665": "#77506f",
      "#9e625f": "#704b6e", "#e3a27c": "#bf8d98", "#bd7c71": "#a57587",
      "#438c5e": "#446c70", "#73c56a": "#69ad8e", "#a3e478": "#a7cd97"
    },
    valley: {
      "#80d0f3": "#282c58", "#8dd9f6": "#383d76", "#a9e4f8": "#4b5591",
      "#c9edfb": "#585f9b", "#e8f9ff": "#666da7", "#f8fdff": "#797cb1",
      "#a2a7df": "#626bb3", "#8f9bd7": "#4c528c", "#e0eefc": "#ada5e1",
      "#9cddaa": "#527f9c", "#a9e5af": "#658fa6", "#70cc9d": "#3d6c92", "#7bd3a0": "#49749a",
      "#88566a": "#3e3966", "#bb796d": "#59598b", "#d28c72": "#6e6d9d", "#a36665": "#484875",
      "#9e625f": "#41416f", "#e3a27c": "#8b86ae", "#bd7c71": "#6b6795",
      "#438c5e": "#396785", "#73c56a": "#58a9b5", "#a3e478": "#94ebdd"
    },
    frost: {
      "#80d0f3": "#557dba", "#8dd9f6": "#77a7cb", "#a9e4f8": "#b5dce5",
      "#a2a7df": "#7c9fc8", "#8f9bd7": "#6885b3", "#e0eefc": "#f0f9fb",
      "#9cddaa": "#aacfd9", "#a9e5af": "#c6e2e5", "#70cc9d": "#8fb6cc", "#7bd3a0": "#a2c6d1",
      "#88566a": "#50688d", "#bb796d": "#7292b1", "#d28c72": "#9abecc", "#a36665": "#65829f",
      "#9e625f": "#658198", "#e3a27c": "#b3dce3", "#bd7c71": "#91b4c8",
      "#438c5e": "#648ea7", "#73c56a": "#a7d4dd", "#a3e478": "#e9faff"
    },
    ruins: {
      "#80d0f3": "#583248", "#8dd9f6": "#843f52", "#a9e4f8": "#bd5757",
      "#ffe590": "#ffb071", "#fff1ad": "#ffcf8d", "#ffd579": "#f98d64",
      "#c9edfb": "#a45471", "#e8f9ff": "#bc677d", "#f8fdff": "#db8a84",
      "#a2a7df": "#854c6c", "#8f9bd7": "#693b5c", "#e0eefc": "#cf797e",
      "#9cddaa": "#925263", "#a9e5af": "#b16572", "#70cc9d": "#774858", "#7bd3a0": "#884b57",
      "#88566a": "#492f4d", "#bb796d": "#734355", "#d28c72": "#985464", "#a36665": "#5d384c",
      "#9e625f": "#58384a", "#e3a27c": "#c66b67", "#bd7c71": "#884756",
      "#438c5e": "#8d4958", "#73c56a": "#c76b64", "#a3e478": "#ffae7c"
    }
  };
  let terrainPalette;

  function rect(x, y, w, h, color) {
    ctx.fillStyle = terrainPalette?.[color] ?? color;
    ctx.fillRect(Math.round(x), Math.round(y), w, h);
  }

  function sparkle(x, y, color, size = 3) {
    rect(x - size, y, size * 2 + 1, 1, color);
    rect(x, y - size, 1, size * 2 + 1, color);
    rect(x - 1, y - 1, 3, 3, color);
  }

  const clouds = [
    [33, 66, 1], [178, 41, 0.62], [250, 79, 0.87], [435, 60, 0.85],
    [532, 98, 0.55], [624, 61, 1.13], [770, 83, 0.77], [859, 51, 0.85],
    [988, 92, 0.78], [1103, 62, 1], [1241, 77, 0.75]
  ];
  const mountains = [
    [-80, 177, 162, 71], [33, 172, 174, 94], [178, 175, 132, 65],
    [263, 179, 168, 81], [387, 175, 131, 75], [480, 180, 190, 99],
    [622, 180, 174, 71], [753, 176, 172, 91], [889, 179, 150, 72]
  ];
  const hills = [
    [-75, 212, 151, 58], [58, 223, 135, 57], [164, 210, 118, 36], [266, 226, 189, 54],
    [428, 224, 170, 67], [573, 228, 163, 47], [716, 221, 172, 70], [856, 224, 163, 47],
    [996, 222, 174, 64], [1145, 223, 184, 51], [1304, 223, 190, 66], [1464, 215, 183, 51],
    [1620, 224, 188, 62], [1790, 225, 180, 50]
  ];

  function cloud(x, y, scale) {
    const block = (dx, dy, w, h, color) =>
      rect(x + dx * scale, y + dy * scale, Math.round(w * scale), Math.round(h * scale), color);
    block(0, 12, 86, 9, "#c9edfb");
    block(8, 6, 63, 14, "#e8f9ff");
    block(20, 0, 28, 13, "#f8fdff");
    block(26, -6, 15, 11, "#f8fdff");
    block(54, 4, 13, 12, "#f8fdff");
    block(0, 12, 13, 5, "#e8f9ff");
    block(73, 13, 11, 4, "#e8f9ff");
  }

  function mountain(x, base, w, h) {
    for (let y = 0; y <= h + 40; y += 4) {
      const spread = Math.floor(Math.min(y / h, 1) * w / 8) * 4;
      const row = base - h + y;
      rect(x + w / 2 - spread, row, 8 + spread * 2, 4, "#a2a7df");
      rect(x + w / 2 + 4, row, spread + 4, 4, "#8f9bd7");
      if (y < h * 0.27) rect(x + w / 2 - spread, row, spread + 9, 4, "#e0eefc");
    }
  }

  function hill(x, base, w, h, pale) {
    for (let y = 0; y <= h + 46; y += 4) {
      const progress = Math.min(y / h, 1);
      const radius = Math.floor(Math.sqrt(2 * progress - progress ** 2) * w / 8) * 4;
      rect(x + w / 2 - radius, base - h + y, radius * 2 + 6, 4, pale ? "#9cddaa" : "#70cc9d");
      if (y > h / 2) {
        rect(x + w / 2 - radius + 5, base - h + y, Math.max(0, radius - 16), 4,
          pale ? "#a9e5af" : "#7bd3a0");
      }
    }
  }

  function tree(x, y, variant) {
    const deep = variant ? "#489b71" : "#57a77b";
    const light = variant ? "#6bc17b" : "#80cd86";
    rect(x - 3, y - 28, 7, 30, "#a17a73");
    rect(x + 1, y - 27, 3, 28, "#bf8f79");
    rect(x - 12, y - 44, 27, 25, deep);
    rect(x - 19, y - 36, 39, 12, deep);
    rect(x - 9, y - 49, 15, 8, light);
    rect(x - 15, y - 43, 25, 18, light);
    rect(x - 8, y - 42, 8, 4, "#a8e199");
    rect(x + 10, y - 29, 3, 3, "#ffe28d");
    rect(x - 10, y - 32, 3, 3, "#ffb2b1");
  }

  function scenery() {
    rect(0, 0, width, height, "#80d0f3");
    rect(0, 82, width, 54, "#8dd9f6");
    rect(0, 136, width, 134, "#a9e4f8");
    const sun = 365 - Math.round(camera * 0.07);
    if (level.theme === "valley") {
      rect(sun - 15, 35, 30, 48, "#f5daff");
      rect(sun - 22, 43, 45, 32, "#f5daff");
      rect(sun - 26, 50, 51, 16, "#f5daff");
      rect(sun + 1, 32, 27, 40, "#282c58");
      rect(sun - 5, 35, 15, 29, "#282c58");
      for (let i = 0; i < 27; i++) {
        const x = (i * 73 + 17) % width;
        const y = 18 + (i * 29) % 105;
        if (Math.abs(x - sun) < 32 && y > 29 && y < 86) continue;
        if (i % 4 === 0) sparkle(x, y, "#c8d7ff", 2);
        else rect(x, y, 1, 1, "#a6b6ec");
      }
    } else {
      rect(sun - 14, 36, 29, 50, "#ffe590");
      rect(sun - 21, 42, 43, 38, "#ffe590");
      rect(sun - 25, 49, 51, 24, "#ffe590");
      rect(sun - 14, 39, 24, 4, "#fff1ad");
      rect(sun - 18, 75, 35, 5, "#ffd579");
      sparkle(sun + 38, 55, "#fff4bf", 4);
      sparkle(sun - 39, 39, "#fff4bf", 3);
      sparkle(sun + 27, 92, "#fff4bf", 2);
      rect(104, 50, 25, 2, "#b8e8fa");
      rect(433, 103, 30, 2, "#c2edfa");
    }
    clouds.forEach(([x, y, scale]) => {
      const px = x - Math.round(camera * 0.25);
      if (px > -115 && px < width) cloud(px, y, scale);
    });
    mountains.forEach(([x, base, w, h]) => {
      const px = x - Math.round(camera * 0.21);
      if (px + w > -10 && px < width) mountain(px, base, w, h);
    });
    hills.forEach(([x, base, w, h], index) => {
      const px = x - Math.round(camera * 0.49);
      if (px + w > -10 && px < width) hill(px, base, w, h, index % 2 === 0);
    });
    const firstTree = Math.max(0, Math.floor((camera * 0.66 - 55) / 69));
    for (let index = firstTree; index < firstTree + 9; index++) {
      if (index % 5 === 2) continue;
      const x = 31 + index * 69 + (index % 3) * 12 - Math.round(camera * 0.66);
      if (x >= width + 23) continue;
      const y = 220 - (index % 3) * 3;
      if (level.theme === "meadow") tree(x, y, index % 2);
      else if (level.theme === "grove") canopyMushroom(x, y, index % 2);
      else if (level.theme === "valley") crystalCluster(x, y, index % 2);
      else if (level.theme === "frost") frostPine(x, y, index % 2);
      else ruinedPillar(x, y, index % 2);
    }
  }

  function canopyMushroom(x, y, variant) {
    rect(x - 4, y - 31, 10, 31, "#9a7394");
    rect(x - 2, y - 34, 4, 32, "#ba91ac");
    rect(x - 20, y - 36, 41, 8, "#71567d");
    rect(x - 17, y - 45, 35, 12, variant ? "#b46d9a" : "#cf798e");
    rect(x - 11, y - 51, 22, 9, variant ? "#cc8eaf" : "#e796a8");
    rect(x - 9, y - 46, 6, 4, "#f4c1bf");
    rect(x + 7, y - 42, 5, 3, "#f4c1bf");
    sparkle(x + 23, y - 45, "#ffde9e", 2);
  }

  function crystalCluster(x, y, variant) {
    const color = variant ? "#9083ce" : "#61aebf";
    const shine = variant ? "#c1a9ed" : "#8ad9d8";
    rect(x - 24, y - 4, 46, 4, "#40466d");
    rect(x - 14, y - 29, 8, 28, color);
    rect(x - 12, y - 33, 5, 31, shine);
    rect(x + 2, y - 46, 13, 45, color);
    rect(x + 5, y - 51, 7, 34, shine);
    rect(x + 6, y - 48, 2, 19, "#bfe7ef");
    rect(x + 15, y - 19, 7, 18, "#7c70aa");
    sparkle(x - 18, y - 40, "#bfe7ef", 2);
  }

  function frostPine(x, y, tall) {
    const up = tall ? 9 : 0;
    rect(x - 3, y - 18, 6, 18, "#586d91");
    for (let i = 0; i < 4; i++) {
      const spread = 3 + i * 4;
      const ty = y - 46 - up + i * 9;
      rect(x - spread, ty, spread * 2 + 1, 10, "#658ba9");
      rect(x - spread, ty, spread * 2 + 1, 4, "#d9f3f5");
    }
  }

  function ruinedPillar(x, y, tall) {
    const h = tall ? 66 : 45;
    rect(x - 19, y - 4, 35, 4, "#664154");
    rect(x - 12, y - h, 21, h - 3, "#5e394f");
    rect(x - 11, y - h, 6, h - 4, "#9d5868");
    rect(x - 15, y - h, 28, 5, "#bc6c73");
    rect(x - 3, y - h + 12, 10, 2, "#d8907e");
    if (tall) sparkle(x - 2, y - h - 7, "#ffba82", 4);
  }

  function flower(x, y, color) {
    rect(x, y - 7, 1, 7, "#297a62");
    rect(x - 2, y - 3, 2, 1, "#46965b");
    rect(x - 2, y - 8, 5, 2, color);
    rect(x, y - 10, 1, 5, color);
    rect(x, y - 8, 1, 1, "#fff4a3");
  }

  function grass(x, y) {
    rect(x, y - 4, 2, 4, "#4d9a57");
    rect(x - 2, y - 3, 1, 3, "#4d9a57");
    rect(x + 2, y - 6, 1, 6, "#62ae58");
  }

  function mushroom(x, y) {
    rect(x - 1, y - 6, 3, 6, "#fff0ca");
    rect(x - 5, y - 9, 11, 4, "#df7192");
    rect(x - 3, y - 12, 7, 5, "#f18aa0");
    rect(x - 2, y - 10, 2, 2, "#ffe0d7");
    rect(x + 2, y - 8, 1, 1, "#ffe0d7");
  }

  function platformArt(platform) {
    if (platform.x + platform.w < camera || platform.x > camera + width) return;
    const { x, y, w } = platform;
    const floor = y === groundY;
    const depth = floor ? height - y : 13;
    rect(x, y, w, depth, "#88566a");
    rect(x + 2, y + 5, w - 4, depth - 7, "#bb796d");
    rect(x + 2, y + 8, w - 4, 4, "#d28c72");
    if (floor) rect(x + 2, y + 33, w - 4, 10, "#a36665");
    rect(x, y, w, 5, "#438c5e");
    rect(x + 2, y, w - 4, 3, "#a3e478");
    rect(x + 2, y + 3, w - 4, 2, "#73c56a");

    const first = Math.max(0, Math.floor((camera - x - 30) / 16));
    for (let i = first; i * 16 < w - 9 && x + i * 16 < camera + width + 16; i++) {
      const tile = x + i * 16;
      rect(tile + 5, y + 5, 5 + i % 3, 2 + i % 2, "#438c5e");
      rect(tile + 7, y + 9, 3, 2, "#e29c7a");
      if (i * 16 + 12 < w) {
        if (i % 4 === 1) flower(tile + 8, y, i % 3 === 0 ? "#fff1a4" : "#f18ba9");
        else if (i % 4 === 3) grass(tile + 8, y);
        else if (floor && i % 9 === 4) mushroom(tile + 8, y);
      }
      if (floor) {
        rect(tile + 3, y + 16 + i % 3 * 6, 7, 4, "#9e625f");
        rect(tile + 5, y + 15 + i % 3 * 6, 4, 2, "#e3a27c");
        rect(tile + 7, y + 35 + i % 2 * 4, 4, 2, "#bd7c71");
      }
    }
  }

  function sign(x) {
    rect(x + 8, groundY - 18, 4, 18, "#855769");
    rect(x, groundY - 27, 22, 13, "#8f5d64");
    rect(x + 1, groundY - 26, 20, 10, "#f1b485");
    rect(x + 5, groundY - 22, 11, 2, "#774c62");
    rect(x + 13, groundY - 24, 2, 6, "#774c62");
    rect(x + 15, groundY - 23, 2, 4, "#774c62");
  }

  function flag() {
    const x = level.goal;
    rect(x - 8, groundY - 5, 19, 5, "#7a536f");
    rect(x - 5, groundY - 8, 13, 4, "#f9c581");
    rect(x, groundY - 73, 4, 65, "#7a536f");
    rect(x + 1, groundY - 70, 2, 60, "#fff1c7");
    rect(x - 2, groundY - 76, 8, 7, "#e5a558");
    rect(x, groundY - 75, 4, 4, "#ffe79b");
    const wave = reduceMotion ? 0 : Math.floor(time * 6) % 2;
    rect(x + 4, groundY - 68, 24, 20, "#864570");
    rect(x + 28, groundY - 65 + wave, 7, 14, "#864570");
    rect(x + 4, groundY - 67, 24, 17, "#ef78a7");
    rect(x + 28, groundY - 64 + wave, 5, 11, "#ef78a7");
    sparkle(x + 16, groundY - 59, "#fff7d7", 4);
    sparkle(x - 12, groundY - 63, "#fffabc", 3);
    sparkle(x + 42, groundY - 44, "#fffabc", 3);
  }

  function gemArt(gem) {
    const y = gem.y + (reduceMotion ? 0 : Math.round(Math.sin(time * 4 + gem.x * 0.04) * 2));
    rect(gem.x + 3, y, 4, 12, "#a65376");
    rect(gem.x + 1, y + 2, 8, 8, "#a65376");
    rect(gem.x + 2, y + 3, 6, 6, "#ffb55f");
    rect(gem.x + 4, y + 1, 2, 10, "#ffc767");
    rect(gem.x + 2, y + 3, 3, 2, "#fff4b1");
    rect(gem.x + 6, y + 6, 2, 2, "#f28482");
    if (!reduceMotion && Math.sin(time * 3 + gem.x) > 0.8) sparkle(gem.x + 13, y + 1, "#fff9cf", 2);
  }

  function slimeArt(enemy) {
    const [outline, shade, body, shine] = slimeColors[enemy.color];
    const bump = reduceMotion ? 0 : Math.round(Math.sin(time * 8 + enemy.left) * 2);
    ctx.save();
    ctx.translate(Math.round(enemy.x), Math.round(enemy.y));
    rect(3, 15, 20, 2, "#55805a");
    rect(3, 4 + bump, 19, 12 - bump, outline);
    rect(0, 9 + bump, 25, 6 - bump, outline);
    rect(7, 1 + bump, 11, 6, outline);
    rect(2, 9 + bump, 21, 5 - bump, shade);
    rect(4, 6 + bump, 17, 7 - bump, body);
    rect(7, 3 + bump, 11, 7, body);
    rect(8, 4 + bump, 5, 2, shine);
    rect(6, 8 + bump, 2, 2, shine);
    const face = enemy.direction === 1 ? 2 : 0;
    rect(7 + face, 9, 2, 3, ink);
    rect(14 + face, 9, 2, 3, ink);
    rect(10 + face, 12, 3, 1, outline);
    rect(4 + face, 12, 3, 1, "#ffb2ae");
    rect(16 + face, 12, 3, 1, "#ffb2ae");
    ctx.restore();
  }

  function enemyArt(enemy) {
    if (enemy.type === "boss") {
      if (enemy.kind === "crystal") crystalGuardianArt(enemy);
      else { bossArt(enemy); finalPhaseArt(enemy); }
      return;
    }
    if (enemy.type === "slime") {
      slimeArt(enemy);
      return;
    }
    const [outline, shadow, body, light] = slimeColors[enemy.color];
    ctx.save();
    ctx.translate(Math.round(enemy.x), Math.round(enemy.y));
    if (enemy.type === "bat") {
      const wing = Math.floor(time * 12) % 2 === 0 ? 2 : 6;
      rect(0, wing, 9, 7, outline);
      rect(16, wing, 9, 7, outline);
      rect(1, wing + 2, 7, 3, body);
      rect(17, wing + 2, 7, 3, body);
      rect(7, 5, 11, 10, outline);
      rect(8, 7, 9, 6, light);
      rect(8, 3, 3, 4, outline);
      rect(14, 3, 3, 4, outline);
      rect(10, 9, 1, 2, ink);
      rect(14, 9, 1, 2, ink);
    } else if (enemy.type === "hopper") {
      rect(3, 3, 16, 16, outline);
      rect(1, 17, 20, 4, outline);
      rect(4, 5, 14, 12, body);
      rect(5, 1, 4, 7, light);
      rect(13, 1, 4, 7, light);
      rect(7, 9, 2, 3, ink);
      rect(13, 9, 2, 3, ink);
      rect(9, 14, 4, 2, light);
    } else if (enemy.type === "beetle") {
      rect(0, 12, 27, 4, ink);
      rect(3, 15, 4, 2, ink);
      rect(18, 15, 4, 2, ink);
      rect(2, 6, 23, 8, outline);
      rect(5, 1, 16, 12, ink);
      rect(6, 2, 14, 9, "#e3ab70");
      rect(7, 3, 4, 5, "#ffe29f");
      rect(15, 3, 1, 7, "#ac6c6e");
      rect(enemy.direction > 0 ? 21 : 3, 8, 2, 2, light);
    } else if (enemy.type === "guard") {
      rect(6, 3, 17, 18, "#353956");
      rect(8, 5, 13, 12, "#7796bc");
      rect(10, 1, 11, 6, "#ccedf4");
      rect(10, 10, 9, 3, "#252943");
      rect(14 + enemy.direction * 2, 10, 2, 2, "#e9faff");
      rect(7, 21, 6, 6, "#353956");
      rect(16, 21, 6, 6, "#353956");
      const shield = enemy.direction > 0 ? 21 : 0;
      const y = enemy.braced ? 8 : 16;
      rect(shield, y, 8, 15 - (y - 8), "#414568");
      rect(shield + 1, y + 1, 6, 10 - (y - 8), "#87e1ed");
      if (enemy.braced) sparkle(shield + 4, y + 6, "#e6fbff", 2);
    } else if (enemy.type === "wisp") {
      rect(4, 3, 14, 13, "#4b4b80");
      rect(2, 6, 18, 7, "#aea8f2");
      rect(7, 4, 8, 11, "#c7f5ff");
      rect(7, 8, 2, 3, "#343761");
      rect(13, 8, 2, 3, "#343761");
      rect(8, 15, 6, 3, "#93d4ee");
      sparkle(0, 10, "#d0ecff", 2);
      sparkle(21, 7, "#d0ecff", 2);
      if (enemy.cooldown < 0.46) sparkle(11, 1, "#feffda", 3);
    } else if (enemy.type === "hound") {
      const head = enemy.direction > 0 ? 17 : 1;
      rect(4, 7, 23, 11, "#4c354f");
      rect(6, 8, 18, 8, enemy.windup ? "#ffb370" : "#d65e63");
      rect(7, 16, 5, 5, "#462d4b");
      rect(20, 16, 5, 5, "#462d4b");
      rect(head, 4, 12, 10, "#603a58");
      rect(head + 1, 1, 5, 6, "#efa47b");
      rect(head + 6, 7, 4, 2, "#fff0ad");
      if (enemy.windup) sparkle(head + 6, 0, "#fff0ad", 2);
    } else {
      rect(4, 11, 14, 15, outline);
      rect(2, 23, 18, 3, ink);
      rect(6, 12, 10, 11, shadow);
      rect(5, 5, 12, 8, ink);
      rect(6, 6, 10, 6, light);
      rect(2, 4, 18, 3, outline);
      rect(7, 1, 8, 4, body);
      rect(8, 8, 2, 2, ink);
      rect(13, 8, 2, 2, ink);
      if (enemy.cooldown < 0.42) sparkle(enemy.direction > 0 ? 21 : 0, 12, "#ffabd3", 3);
    }
    if (enemy.flash > 0) rect(enemy.w / 2 - 3, enemy.h / 2, 6, 2, "#fff8df");
    if (enemy.hp < enemy.maxHp) {
      rect(2, -4, enemy.w - 4, 2, ink);
      rect(2, -4, Math.round((enemy.w - 4) * enemy.hp / enemy.maxHp), 2, "#ffafc9");
    }
    ctx.restore();
  }

  function bossArt(enemy) {
    const { x, y, mode, attack, hp, maxHp, flash } = enemy;
    const core = mode === "dormant" ? "#976a7e" : hp <= maxHp / 2 ? "#fff1b3" : "#ffa15f";
    rect(x + 4, y + 19, 52, 33, "#422d49");
    rect(x + 11, y + 8, 38, 40, "#58344d");
    rect(x + 17, y + 2, 26, 26, "#673952");
    rect(x + 12, y + 10, 36, 18, "#98505c");
    rect(x + 13, y + 10, 31, 4, "#ba6670");
    rect(x + 18, y + 16, 7, 5, "#362c48");
    rect(x + 35, y + 16, 7, 5, "#362c48");
    rect(x + 19, y + 17, 4, 2, core);
    rect(x + 36, y + 17, 4, 2, core);
    rect(x + 1, y + 29, 14, 20, "#663d53");
    rect(x + 46, y + 29, 13, 20, "#663d53");
    rect(x + 3, y + 29, 10, 4, "#ba6670");
    rect(x + 47, y + 29, 10, 4, "#ba6670");
    rect(x + 9, y + 48, 16, 9, "#362c48");
    rect(x + 35, y + 48, 16, 9, "#362c48");
    rect(x + 21, y + 29, 18, 16, "#723d55");
    if (mode === "recover") {
      rect(x + 24, y + 31, 12, 12, "#ff7c59");
      sparkle(x + 30, y + 37, core, flash > 0 ? 6 : 4);
    } else {
      rect(x + 23, y + 32, 14, 5, "#a85a66");
      if (mode === "windup") {
        if (attack === "curtain") rect(x - 8, groundY - 3, 76, 3, "#ffc071");
        sparkle(x + 30, y + (attack === "curtain" ? 50 : 24), "#ffbe73", 5);
      }
    }
  }

  // These screen-space paths stay behind the terrain, combat cues and projectiles.
  const domainStars = Array.from({ length: 39 }, (_, i) => ({
    x: ((i * 127 + i * i * 11 + 23) % 479) / 480,
    y: ((i * 61 + i * i * 3 + 13) % 239) / 270
  }));

  function domainBackdrop(remaining) {
    if (!(remaining > 0)) return;
    const elapsed = 4 - remaining;
    const fade = Math.max(0, Math.min(1, elapsed / 0.42, remaining / 0.55));
    const motion = reduceMotion ? 0 : elapsed;
    ctx.save();
    ctx.globalAlpha = fade * 0.95;
    rect(0, 0, width, height, "#191434");
    ctx.globalAlpha = fade;
    // Offset ellipses around a single distant pole suggest folded starlight.
    const poleX = width * 0.46, poleY = height * 0.40;
    ctx.save();
    ctx.translate(poleX, poleY);
    ctx.rotate(-0.17);
    for (let i = 3; i >= 0; i--) {
      const radius = 28 + i * i * 23 + motion * (2 + i);
      ctx.beginPath();
      ctx.ellipse(0, i * 2, radius, radius * 0.34, 0, 0, Math.PI * 2);
      ctx.fillStyle = ["#25224d", "#292955", "#282047", "#252042"][i];
      ctx.fill();
      ctx.strokeStyle = ["#9589c1", "#64639e", "#504780", "#3e356a"][i];
      ctx.lineWidth = i === 1 ? 2 : 1;
      ctx.stroke();
    }
    ctx.restore();
    for (let i = 0; i < domainStars.length; i++) {
      const star = domainStars[i];
      const x = star.x * width + Math.sin(i + motion * 0.45) * (reduceMotion ? 0 : 2);
      const y = star.y * height - motion * (i % 3) * 0.7;
      if (i % 8 === 0) sparkle(x, y, "#adacd9", 2);
      else rect(x, y, i % 4 === 0 ? 2 : 1, 1, i % 2 ? "#857ba7" : "#719db7");
    }
    // A pair of small satellites orbits the still center without whole-screen motion.
    for (let i = 0; i < 2; i++) {
      const angle = 0.63 + motion * 0.32 + i * Math.PI;
      const dx = Math.cos(angle) * 54, dy = Math.sin(angle) * 17;
      sparkle(poleX + dx, poleY + dy - dx * 0.17, i ? "#bcabdf" : "#94d7df", 2);
    }
    ctx.restore();
  }

  function templeBackdrop(remaining) {
    const elapsed = 4 - remaining;
    const fade = clamp(Math.min(elapsed / 0.42, remaining / 0.55), 0, 1);
    ctx.save();
    ctx.globalAlpha = fade;
    rect(0, 0, width, height, "#2d1428");
    rect(0, 135, width, 135, "#451b2d");
    // Pillars and stepped roof tiles frame the rear altar.
    for (const x of [22, 77, 142, 309, 376, 431]) {
      rect(x, 59, 17, 166, "#351526");
      rect(x + 2, 66, 5, 137, "#773040");
      rect(x - 5, 61, 27, 9, "#a2474d");
      rect(x - 4, 193, 25, 10, "#63283b");
    }
    for (let tier = 0; tier < 5; tier++) {
      const halfWidth = 53 + tier * 18;
      rect(240 - halfWidth, 51 + tier * 9, halfWidth * 2, 9, tier % 2 ? "#693044" : "#50243a");
    }
    rect(197, 97, 86, 99, "#693044");
    rect(211, 106, 58, 90, "#351526");
    rect(229, 135, 22, 61, "#ac4350");
    for (let i = 0; i < 3; i++) rect(189 - i * 17, 197 + i * 9, 102 + i * 34, 8, "#793340");

    // Slashes stay behind enemies and telegraphs. Reduced motion uses fixed marks.
    for (let i = 0; i < 5; i++) {
      const phase = reduceMotion ? 0.45 : (elapsed * 1.4 + i * 0.21) % 1;
      const x = 36 + i * 83 + phase * 52;
      const y = 113 + (i % 3) * 31 - phase * 22;
      ctx.globalAlpha = fade * (0.27 + 0.48 * Math.sin(phase * Math.PI));
      for (let part = 0; part < 16; part++) {
        const slashY = y - part * (i % 2 ? 2 : -2);
        rect(x + part * 5, slashY, 5, 4 + (part % 3), "#ff626c");
        rect(x + part * 5, slashY + 2, 5, 1, "#ffc2a8");
      }
    }
    ctx.restore();
  }

  function phaseBackdrop(enemy) {
    if (!enemy || enemy.phase !== 2 || enemy.hp <= 0) return;
    ctx.save();
    ctx.globalAlpha = enemy.mode === "transition" ? 0.24 : 0.32;
    rect(0, 0, width, height, "#54204a");
    ctx.restore();
  }

  // Draw a cut crystal from stepped horizontal facets, with a bright ridge.
  function guardianShard(x, y, radius, size, light, shade) {
    for (let row = 0; row < size; row += 2) {
      const t = (row + 1) / size;
      const span = Math.max(1, Math.round(radius * Math.min(t / 0.50, (1 - t) / 0.50)));
      rect(x - span - 1, y + row, span * 2 + 2, 2, "#35335e");
      rect(x - span, y + row, span, 2, light);
      rect(x, y + row, span, 2, shade);
    }
  }

  function crystalGuardianArt(enemy) {
    const { x, y, w, h } = enemy;
    const intro = enemy.mode === "intro" ? Math.max(0, Math.min(1, enemy.timer / 1.15)) : 0;
    const rise = reduceMotion ? 0 : Math.round(9 * intro * intro);
    const bob = reduceMotion || enemy.mode === "dormant" ? 0 : Math.round(Math.sin(time * 2.7));
    const gleam = enemy.flash > 0 ? "#fff3df" : "#b6fff2";
    ctx.save();
    ctx.translate(Math.round(x + w / 2), Math.round(y + h));
    rect(-21, -3, 42, 3, "#383853");
    rect(-14, -2, 28, 1, "#657296");
    ctx.translate(0, -rise + bob);
    // The two suspended forepaws fold out of a cluster of geodes on entry.
    const split = reduceMotion ? 0 : Math.round(7 * intro);
    for (const side of [-1, 1]) {
      const paw = side * (23 + split);
      guardianShard(paw, -32 - rise, 6, 18, "#8bcbd7", "#797bc6");
      rect(paw - 5, -25 - rise, 9, 3, "#5a639c");
      rect(paw - 4, -22 - rise, 2, 3, "#e9c29a");
      rect(paw, -22 - rise, 2, 3, "#e9c29a");
      rect(side * 11 - 5, -8, 10, 7, "#484366");
      rect(side * 11 - 4, -7, 8, 3, "#969ad0");
    }
    // A star-cut crest, two tiny ears and a wide round visor give the keeper its silhouette.
    guardianShard(-13, -48 - rise, 5, 18, "#a1b7ed", "#706bae");
    guardianShard(13, -48 - rise, 5, 18, "#a1b7ed", "#706bae");
    guardianShard(0, -55 - rise, 7, 21, "#b3e7f1", "#7c90c9");
    rect(-13, -42, 26, 37, "#393b62");
    rect(-18, -38, 36, 28, "#393b62");
    rect(-21, -32, 42, 16, "#393b62");
    rect(-12, -40, 24, 33, "#837fc1");
    rect(-17, -36, 34, 23, "#94afcb");
    rect(-19, -31, 38, 13, "#abcbd4");
    rect(-13, -35, 26, 3, "#d3e6e4");
    rect(-14, -29, 28, 12, "#424466");
    rect(-16, -26, 32, 6, "#424466");
    const gaze = enemy.direction < 0 ? -1 : 1;
    rect(-9 + gaze, -26, 3, 4, gleam);
    rect(6 + gaze, -26, 3, 4, gleam);
    rect(-2, -21, 4, 1, "#aabbd2");
    rect(-13, -22, 3, 1, "#e4a9c8");
    rect(10, -22, 3, 1, "#e4a9c8");
    guardianShard(0, -16, 5, 13, "#efc3c0", "#c38db8");
    if (enemy.mode === "windup" || enemy.mode === "intro") {
      sparkle(0, -48 - rise, gleam, 3);
      rect(-13, -13, 5, 2, "#b6fff2");
      rect(8, -13, 5, 2, "#b6fff2");
    }
    if (enemy.flash > 0) {
      rect(8, -39, 5, 2, gleam);
      rect(11, -37, 2, 3, gleam);
      rect(13, -35, 2, 3, gleam);
    }
    ctx.restore();
  }

  function crystalDefeatArt(fx) {
    if (!fx || fx.life <= 0) return;
    const progress = Math.max(0, Math.min(1, 1 - fx.life / 0.95));
    ctx.save();
    ctx.globalAlpha = Math.min(1, fx.life / 0.48);
    const radius = reduceMotion ? 15 : 5 + progress * 37;
    for (let i = 0; i < 8; i++) {
      const angle = i * Math.PI / 4 - Math.PI / 2;
      const x = fx.x + Math.cos(angle) * radius;
      const y = fx.y + Math.sin(angle) * radius * 0.75 - (reduceMotion ? 0 : progress * 13);
      guardianShard(x, y, i % 2 ? 2 : 3, i % 2 ? 6 : 8, "#d3f3f3", "#ac8ecd");
    }
    sparkle(fx.x, fx.y, "#f3d4dc", 4);
    ctx.restore();
  }

  function finalPhaseArt(enemy) {
    if (enemy.phase !== 2 || enemy.hp <= 0) return;
    const x = Math.round(enemy.x), y = Math.round(enemy.y);
    const open = enemy.mode === "open", charging = enemy.mode === "transition";
    const amber = charging ? "#ffcd86" : "#f3a563";
    rect(x + 3, y + 33, 7, 2, amber);
    rect(x + 8, y + 35, 2, 4, amber);
    rect(x + 49, y + 35, 6, 2, amber);
    rect(x + 49, y + 37, 2, 4, amber);
    rect(x + 20, y + 29, 20, 18, "#412e48");
    if (open || charging) {
      const light = charging ? "#ffd17e" : "#c2fff1";
      rect(x + 23, y + 30, 14, 16, "#ab625b");
      rect(x + 21, y + 33, 18, 10, "#ab625b");
      rect(x + 25, y + 32, 10, 12, charging ? "#f39558" : "#56b6ad");
      rect(x + 23, y + 35, 14, 6, charging ? "#ffba72" : "#7cd4c0");
      sparkle(x + 30, y + 38, light, open ? 5 : 3);
      if (open) {
        rect(x + 16, y + 32, 3, 11, "#d28872");
        rect(x + 41, y + 32, 3, 11, "#d28872");
      }
    } else {
      // The crossbar and its square clasp remain readable even over weapon effects.
      rect(x + 21, y + 31, 18, 13, "#805268");
      rect(x + 22, y + 32, 16, 3, "#b77478");
      rect(x + 21, y + 37, 18, 3, "#533849");
      rect(x + 28, y + 34, 5, 8, "#d3a078");
      rect(x + 30, y + 36, 1, 4, "#6d4550");
    }
  }

  function sealArt(x) {
    rect(x - 2, 106, 15, groundY - 106, "#663757");
    rect(x, 110, 10, groundY - 110, "#fa9873");
    rect(x + 3, 110, 4, groundY - 110, "#ffe5ac");
    for (let y = 117; y < groundY; y += 18) sparkle(x + 5, y, "#b75260", 3);
  }

  function adventurer(drawX) {
    if (player.immunity > 0) {
      // A continuous two-tone shield keeps the sprite readable throughout immunity.
      const x = drawX + player.w / 2, y = Math.round(player.y + 10);
      ctx.save();
      ctx.beginPath();
      ctx.ellipse(x, y, 15, 19, 0, 0, Math.PI * 2);
      ctx.fillStyle = "#72e8de36";
      ctx.fill();
      ctx.strokeStyle = "#255665";
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.strokeStyle = "#b9fff4";
      ctx.lineWidth = 1;
      ctx.stroke();
      if (player.immunity > 0.78) {
        ctx.fillStyle = "#56283d";
        ctx.font = "bold 10px monospace";
        ctx.fillText("−1", x - 6, y - 21);
      }
      ctx.restore();
    }
    const running = player.grounded && Math.abs(player.vx) > 15;
    const stride = running && !reduceMotion ? Math.floor(time * 14) % 2 : 0;
    const bob = running && !reduceMotion ? stride : 0;
    ctx.save();
    ctx.translate(drawX + (player.facing < 0 ? player.w : 0), Math.round(player.y) - bob);
    ctx.scale(player.facing, 1);

    drawCharacter(ctx, characterId, stride, bob, weapons[weaponIndex].color ?? "#8a80c2");
    ctx.restore();
  }

  const outfits = {
    astral: {
      "#8266ac": "#5678b0", "#c6a0d3": "#a8d9f7", "#5676ba": "#c5e5ff", "#7498d1": "#76a4dc",
      "#b94374": "#3766aa", "#f37e9c": "#8dc7f4", "#ed6994": "#8dc7f4",
      "#ffda78": "#e2f8ff", "#fff0a1": "#ffffff", "#e99555": "#7bafdc", "#ffc870": "#a6d5f7"
    },
    crimson: {
      "#8266ac": "#512c48", "#c6a0d3": "#d4556a", "#5676ba": "#3b263a", "#7498d1": "#764053",
      "#b94374": "#922944", "#f37e9c": "#e34961", "#ed6994": "#e34961",
      "#ffda78": "#c93650", "#fff0a1": "#ffa689", "#e99555": "#912941"
    }
  };

  function drawCharacter(target, id, stride, bob, weaponColor) {
    const outfit = outfits[id];
    const pixel = (x, y, w, h, color) => {
      target.fillStyle = outfit[color] ?? color;
      target.fillRect(x, y, w, h);
    };
    pixel(-3, 10, 6, 10, ink);
    pixel(-2, 11, 6, 7, "#8266ac");
    pixel(-1, 11, 3, 2, "#c6a0d3");
    pixel(2, 11, 12, 11, ink);
    pixel(3, 13, 10, 7, "#5676ba");
    pixel(3, 13, 3, 5, "#7498d1");
    pixel(2, 12, 14, 4, "#b94374");
    pixel(3, 12, 12, 2, "#f37e9c");
    pixel(-3 - stride, 13, 6, 3, "#ed6994");
    pixel(-4 - stride, 15, 4, 2, "#b94374");
    pixel(3 - stride, 19, 5, 4 + bob, ink);
    pixel(10 + stride, 18, 5, 5 + bob, ink);
    pixel(4 - stride, 20, 3, 2, "#9d6a82");
    pixel(11 + stride, 20, 3, 2, "#9d6a82");

    pixel(1, 4, 15, 9, ink);
    pixel(3, 5, 12, 7, "#ffcb9d");
    pixel(3, 5, 3, 5, "#9b5e66");
    pixel(8, 6, 7, 4, "#ffdeaf");
    pixel(11, 7, 2, 3, ink);
    pixel(13, 10, 2, 1, "#f29194");
    if (id === "crimson") {
      pixel(1, 1, 14, 5, ink);
      pixel(3, -3, 12, 8, ink);
      pixel(4, -2, 9, 5, "#ffda78");
      pixel(8, -2, 3, 3, "#fff0a1");
      pixel(-1, 3, 17, 3, "#e99555");
      pixel(2, 5, 3, 2, "#fff0a1");
    } else {
      pixel(1, 0, 13, 5, ink);
      pixel(3, -1, 9, 2, ink);
      pixel(2, 1, 11, 4, "#ffda78");
      pixel(4, 1, 5, 2, "#fff0a1");
      pixel(2, 4, 11, 2, "#e99555");
      pixel(-1, 5, 19, 2, ink);
      pixel(0, 5, 16, 1, "#ffc870");
      pixel(9, 1, 2, 3, "#7498d1");
    }
    pixel(12, 15, 8, 5, ink);
    pixel(13, 16, 6, 3, weaponColor);
    pixel(17, 16, 2, 2, "#c7ebff");
    pixel(13, 18, 2, 2, "#ffc49b");
  }

  function brickArt(brick) {
    if (brick.x + brick.w < camera || brick.x > camera + width) return;
    const { x, w, h, weapon } = brick;
    const opened = unlocked.has(weapon);
    const artifact = weapons[weapon].artifact;
    const y = brick.y - (reduceMotion ? 0 : Math.round(Math.sin(brick.bump / 0.23 * Math.PI) * 5));
    rect(x + 1, y + h, w - 2, 2, "#34304d");
    rect(x, y, w, h, "#42334e");
    rect(x + 2, y + 2, w - 4, h - 4, opened ? "#8e7d94" : artifact ? "#a64559" : "#c77d4b");
    rect(x + 2, y + 2, w - 4, 9, opened ? "#a798ad" : artifact ? "#ff925f" : "#ffc86e");
    rect(x + 5, y + 4, 2, 2, "#fff0ae");
    rect(x + w - 7, y + h - 6, 2, 2, "#99624d");
    if (opened) {
      rect(x + 9, y + 8, 7, 2, "#5b506b");
      return;
    }
    if (weapons[weapon].kind === "lightning") {
      rect(x + 2, y + 2, w - 4, h - 4, "#6566b4");
      rect(x + 12, y + 3, 5, 3, "#c8fcff");
      rect(x + 9, y + 6, 7, 3, "#adf3ff");
      rect(x + 11, y + 9, 3, 4, "#c8fcff");
      return;
    }
    sparkle(x + 12, y + 7, "#75476b", 4);
    rect(x + 12, y + 6, 2, 2, "#fff8d0");
    if (!reduceMotion && Math.sin(time * 4 + x) > 0.55) sparkle(x + w + 3, y - 2, "#fff6bd", 2);
  }

  function beamArt() {
    const { x, y, w, h, end } = beam;
    if (w < 1) return;
    rect(x, y, w, h, "#a83956");
    rect(x, y + 1, w, h - 2, "#ff7951");
    rect(x, y + 3, w, h - 6, "#ffc759");
    rect(x, y + 4, w, 2, "#fff7c7");
    sparkle(end, y + h / 2, "#ffe7a6", 5);
    const offset = reduceMotion ? 5 : Math.floor(time * 94) % 17;
    for (let i = offset; i < w; i += 17) {
      rect(x + i, y - 2, 2, 1, "#ffc759");
      rect(x + i, y + h + 1, 2, 1, "#ff9f5d");
    }
  }

  function shotArt(shot) {
    const { x, y, w, h, color } = shot;
    if (shot.kind === "flame") {
      const size = 3 + Math.round((0.24 - shot.life) * 19);
      rect(x, y - 1, size + 3, size + 1, "#f56d4c");
      rect(x + 2, y + 1, size, size - 1, color);
      rect(x + 3, y + 1, 2, 2, "#fff2a6");
      return;
    }
    rect(x + (shot.vx > 0 ? -5 : w - 2), y + 1, w, h - 2, color);
    rect(x + 1, y, w - 2, h, color);
    rect(x + 2, y + 1, w - 3, h - 2, "#fff9db");
  }

  function arcArt({ x, y, toX, toY }) {
    const dx = toX - x, dy = toY - y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const segments = Math.max(2, Math.ceil(distance / 9));
    const phase = reduceMotion ? 0 : Math.floor(time * 12);
    const points = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const jitter = (i === 0 || i === segments) ? 0 : Math.sin(i * 1.87 + phase * 1.41) * 4;
      points.push([Math.round(x + dx * t - dy * jitter / distance),
        Math.round(y + dy * t + dx * jitter / distance)]);
    }
    ctx.beginPath();
    ctx.moveTo(...points[0]);
    for (const point of points.slice(1)) ctx.lineTo(...point);
    ctx.strokeStyle = "#7964c7";
    ctx.lineWidth = 5;
    ctx.stroke();
    ctx.strokeStyle = "#83dcff";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.strokeStyle = "#f3ffff";
    ctx.lineWidth = 1;
    ctx.stroke();
    for (let i = 3; i < segments; i += 5) {
      const [px, py] = points[i];
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px + 3, py - 5);
      ctx.lineTo(px + 7, py - 7);
      ctx.stroke();
    }
    sparkle(toX, toY, "#ccffff", 4);
  }

  function ultimateArt() {
    ctx.save();
    if (ultimateCharge) {
      const progress = 1 - ultimateCharge / ultimateChargeTime;
      const direction = player.facing;
      const x = player.x + player.w / 2 + direction * (14 + progress * 10);
      const y = player.y + 13;
      if (characterId === "astral") {
        const radius = 3 + Math.floor(progress * 15);
        const separation = 17 * (1 - progress);
        rect(x - radius, y - radius / 2, radius * 2, radius, "#8b53bdad");
        sparkle(x - separation, y - separation * 0.65, "#79dcff", 5);
        sparkle(x + separation, y + separation * 0.65, "#ff8c9f", 5);
        sparkle(x, y, "#dba5ff", radius);
      } else {
        // The rift trembles locally. Terrain, enemies and the HUD stay anchored.
        const tremor = !reduceMotion && progress > 0.45 ? Math.round(Math.sin(time * 19)) : 0;
        const extent = Math.floor(18 + progress * 105);
        for (let d = 0; d < extent; d += 6) {
          const px = x + direction * d;
          const py = y + tremor + (d % 18 === 0 ? 2 : -2) - d * 0.16;
          rect(px, py - 3, 7, 7, "#371220d9");
          rect(px, py, 6, 2, "#ff7d889d");
        }
      }
    }
    if (ultimateOrb) {
      const { x, y, w, h, vx } = ultimateOrb;
      const front = vx > 0;
      const center = x + w / 2, middle = y + h / 2;
      rect(front ? x - 20 : x + 20, middle - 6, 42, 12, "#984bcb93");
      rect(x + 3, y + 5, w - 6, h - 10, "#8548bc");
      rect(x + 10, y, w - 20, h, "#a46be2");
      rect(x + 7, y + 7, w - 14, h - 14, "#c28aef");
      sparkle(center, middle, "#eed8ff", 10);
    }
    if (ultimateSlash) {
      const { x, y, w, h, direction, life } = ultimateSlash;
      ctx.globalAlpha = Math.min(0.75, life / 0.32);
      for (let i = 0; i < w; i += 8) {
        const px = direction > 0 ? x + i : x + w - i - 8;
        const py = y + h * 0.73 - i / w * h * 0.53;
        rect(px, py - 11, 8, 23, "#401727");
        rect(px, py - 6, 8, 13, "#e64f65");
        rect(px, py - 1, 8, 3, "#ffd0ad");
      }
    }
    ctx.restore();
  }

  function render(alpha = 1) {
    if (normalViewWidth() !== baseViewWidth) resetCamera();
    const drawX = previousPlayerX + (player.x - previousPlayerX) * alpha;
    frameCamera(drawX);
    terrainPalette = sceneryPalettes[level.theme];
    scenery();
    phaseBackdrop(boss);
    activeDomain?.backdrop(domainTicks / 60);
    ctx.save();
    ctx.translate(-Math.round(camera), 0);
    for (const [left, right] of pits) {
      if (right < camera || left > camera + width) continue;
      const hot = level.theme === "ruins";
      const crystal = level.theme === "valley";
      rect(left, 260, right - left, 10, hot ? "#dd7765" : crystal ? "#59558e" : "#79beae");
      rect(left + 8, 258, 24, 2, hot ? "#ffc379" : crystal ? "#8f83ba" : "#a3d7c2");
    }
    for (const platform of platforms) {
      if (platform.weapon === undefined) platformArt(platform);
    }
    terrainPalette = undefined;
    ultimateArt();
    if (boss?.hp > 0 && boss.mode !== "dormant") barrageGuide();
    bricks.forEach(brickArt);
    if (camera < 50) sign(27);
    if (boss?.hp > 0 && camera + width > level.arena.gate) sealArt(level.arena.gate);
    if (camera + width > level.goal - 40) flag();
    gems.forEach(gem => {
      if (gem.x > camera - 12 && gem.x < camera + width + 8) gemArt(gem);
    });
    enemies.forEach(enemy => {
      if (enemy.x + enemy.w > camera && enemy.x < camera + width) enemyArt(enemy);
    });
    crystalDefeatArt(crystalDefeat);
    shots.forEach(shotArt);
    if (beam) beamArt();
    arcs.forEach(arcArt);
    for (const shot of enemyShots) {
      if (shot.delay > 0) continue;
      if (shot.kind === "wave") {
        rect(shot.x, shot.y + 8, shot.w, 4, "#b75058");
        rect(shot.x + 3, shot.y + 4, 9, 6, "#fa7c61");
        rect(shot.x + 5, shot.y + 1, 5, 7, shot.color);
      } else if (shot.kind === "rain" || shot.kind === "curtain" || shot.kind === "shard") {
        rect(shot.x, shot.y, shot.w, shot.h, "#7c4669");
        rect(shot.x + 1, shot.y + 1, shot.w - 2, shot.h - 2, shot.color);
        rect(shot.x + 2, shot.y + 2, 2, 2, "#fff5dd");
      } else {
        rect(shot.x + 1, shot.y + 1, 5, 5, "#a748a0");
        sparkle(shot.x + 3, shot.y + 3, shot.color, 3);
      }
    }
    adventurer(Math.round(drawX - camera) + Math.round(camera));
    for (const particle of particles) {
      rect(particle.x, particle.y, particle.life > 0.16 ? 3 : 2, 2, particle.color);
    }
    ctx.restore();
  }

  function frame(timestamp) {
    if (previousTime === undefined) previousTime = timestamp;
    accumulator += Math.min((timestamp - previousTime) / 1000, 0.065);
    previousTime = timestamp;
    while (accumulator >= step) {
      if (state === "playing" && !menuOpen()) update(step);
      accumulator -= step;
    }
    sound.scheduleMusic();
    if (state !== "playing" || menuOpen()) previousPlayerX = player.x;
    render(accumulator / step);
    requestAnimationFrame(frame);
  }

  reset();
  bestLabel.textContent = String(best);
  function beginAdventure() {
    if (savedRun) {
      const map = levels[savedRun.stage];
      const at = savedRun.floor === 64 ? "關卡起點" : "最近的地面檢查點";
      document.querySelector("#save-detail").textContent = `第 ${savedRun.stage + 1} 關「${map.name}」 · ${at} · 最高分 ${best}`;
      if (savedRun.completed) document.querySelector("#continue-game").textContent = "重玩第五關";
      openPanel(continuePanel);
    } else if (readLocal("guideSeen") !== true) {
      showGuide();
    } else {
      allowSave = true;
      saveRun();
    }
  }
  for (const card of characterCards) {
    const preview = card.querySelector("canvas").getContext("2d");
    preview.translate(7, 5);
    drawCharacter(preview, card.dataset.character, 0, 0, "#8a80c2");
  }
  if (choosingAtLaunch) showCharacters();
  else beginAdventure();
  requestAnimationFrame(frame);
})();
