import React, { useEffect, useMemo, useRef, useState } from "react";

// Game: Tap untuk lompat, hindari rintangan. Cocok untuk mobile (tap di mana saja)
// Dibuat 1-file (React) agar mudah dipelajari & dimodifikasi.
// Styling pakai Tailwind. Tidak butuh library eksternal.

export default function MobileJumpGame() {
  // ====== Konstanta Gameplay ======
  const GRAVITY = 2500; // px/s^2
  const JUMP_VELOCITY = -900; // px/s, negatif = ke atas
  const BASE_SPEED = 260; // px/s
  const SPEED_GROWTH = 12; // tambahan kecepatan per 10 detik
  const GROUND_HEIGHT = 24; // px relatif ke canvas
  const PLAYER_SIZE = 40; // sisi persegi pemain
  const SPAWN_MIN = 0.9; // detik
  const SPAWN_MAX = 1.8; // detik
  const OBSTACLE_MIN_W = 24;
  const OBSTACLE_MAX_W = 60;
  const OBSTACLE_MIN_H = 40;
  const OBSTACLE_MAX_H = 90;

  // ====== Area Game (responsive) ======
  // Kanvas virtual 9:16 agar pas di layar HP; nanti diskalakan ke container.
  const VIRTUAL_W = 360;
  const VIRTUAL_H = 640;

  // ====== State ======
  const [running, setRunning] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [hint, setHint] = useState("Tap untuk lompat");

  // Posisi & kecepatan pemain (koordinat virtual)
  const playerY = useRef(VIRTUAL_H - GROUND_HEIGHT - PLAYER_SIZE);
  const playerVY = useRef(0);

  // Rintangan: {id, x, w, h}
  const obstacles = useRef([] as { id: number; x: number; w: number; h: number }[]);

  // Loop
  const lastTime = useRef<number | null>(null);
  const raf = useRef<number | null>(null);

  // Lain-lain
  const spawnTimer = useRef(0); // detik menuju spawn berikutnya
  const elapsed = useRef(0); // total detik sejak start
  const speedRef = useRef(BASE_SPEED);
  const idCounter = useRef(0);

  // Skala responsif berdasarkan lebar container
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);

  // ====== Helpers ======
  function resetGame() {
    playerY.current = VIRTUAL_H - GROUND_HEIGHT - PLAYER_SIZE;
    playerVY.current = 0;
    obstacles.current = [];
    setScore(0);
    elapsed.current = 0;
    speedRef.current = BASE_SPEED;
    spawnTimer.current = rand(SPAWN_MIN, SPAWN_MAX);
    setGameOver(false);
  }

  function startGame() {
    const stored = Number(localStorage.getItem("bestScore") || 0);
    setBest(stored);
    resetGame();
    setRunning(true);
  }

  function endGame() {
    setRunning(false);
    setGameOver(true);
    const newBest = Math.max(best, score);
    setBest(newBest);
    localStorage.setItem("bestScore", String(newBest));
  }

  function jump() {
    if (!running) {
      // Mulai ulang saat game over
      if (gameOver) {
        startGame();
      }
      return;
    }
    // Boleh lompat jika berada di tanah (toleransi kecil)
    const groundY = VIRTUAL_H - GROUND_HEIGHT - PLAYER_SIZE;
    if (playerY.current >= groundY - 1) {
      playerVY.current = JUMP_VELOCITY;
    }
  }

  function rand(min: number, max: number) {
    return Math.random() * (max - min) + min;
  }

  function spawnObstacle() {
    const w = rand(OBSTACLE_MIN_W, OBSTACLE_MAX_W);
    const h = rand(OBSTACLE_MIN_H, OBSTACLE_MAX_H);
    const id = idCounter.current++;
    obstacles.current.push({ id, x: VIRTUAL_W + 8, w, h });
  }

  function aabbCollide(
    ax: number,
    ay: number,
    aw: number,
    ah: number,
    bx: number,
    by: number,
    bw: number,
    bh: number
  ) {
    return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
  }

  // ====== Game Loop ======
  useEffect(() => {
    if (!running) return;

    const step = (t: number) => {
      if (lastTime.current == null) lastTime.current = t;
      const dt = Math.min((t - lastTime.current) / 1000, 0.033); // clamp 30 FPS max delta
      lastTime.current = t;

      // Waktu total & scaling kesulitan
      elapsed.current += dt;
      speedRef.current = BASE_SPEED + (Math.floor(elapsed.current / 10) * SPEED_GROWTH);

      // Update pemain
      playerVY.current += GRAVITY * dt;
      playerY.current += playerVY.current * dt;

      const groundY = VIRTUAL_H - GROUND_HEIGHT - PLAYER_SIZE;
      if (playerY.current > groundY) {
        playerY.current = groundY;
        playerVY.current = 0;
      }

      // Spawn rintangan
      spawnTimer.current -= dt;
      if (spawnTimer.current <= 0) {
        spawnObstacle();
        spawnTimer.current = rand(SPAWN_MIN, SPAWN_MAX);
      }

      // Gerakkan & bersihkan rintangan; hitung skor saat lewat
      let passed = 0;
      obstacles.current = obstacles.current
        .map((o) => ({ ...o, x: o.x - speedRef.current * dt }))
        .filter((o) => {
          const off = o.x + o.w > -20; // masih terlihat
          if (!off) passed += 1;
          return off;
        });

      if (passed > 0) setScore((s) => s + passed);

      // Cek tabrakan
      const playerX = 52; // posisi X tetap
      const playerRect = {
        x: playerX,
        y: playerY.current,
        w: 40,
        h: 40,
      };

      for (const o of obstacles.current) {
        const obsRect = {
          x: o.x,
          y: VIRTUAL_H - GROUND_HEIGHT - o.h,
          w: o.w,
          h: o.h,
        };
        if (
          aabbCollide(
            playerRect.x,
            playerRect.y,
            playerRect.w,
            playerRect.h,
            obsRect.x,
            obsRect.y,
            obsRect.w,
            obsRect.h
          )
        ) {
          endGame();
          return; // stop loop; useEffect cleanup akan membatalkan rAF
        }
      }

      raf.current = requestAnimationFrame(step);
    };

    raf.current = requestAnimationFrame(step);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
      raf.current = null;
      lastTime.current = null;
    };
  }, [running]);

  // ====== Responsif: update scale saat resize ======
  useEffect(() => {
    function onResize() {
      const el = containerRef.current;
      if (!el) return;
      const cw = el.clientWidth;
      const ch = el.clientHeight;
      const scaleX = cw / VIRTUAL_W;
      const scaleY = ch / VIRTUAL_H;
      setScale(Math.min(scaleX, scaleY));
    }
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // ====== Input: tap/klik/keyboard ======
  useEffect(() => {
    const onPointer = (e: PointerEvent) => {
      e.preventDefault();
      jump();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Space" || e.code === "ArrowUp") {
        e.preventDefault();
        jump();
      }
      if (e.code === "KeyP") {
        setRunning((r) => !r && !gameOver ? true : r);
      }
    };
    window.addEventListener("pointerdown", onPointer, { passive: false });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onPointer);
      window.removeEventListener("keydown", onKey);
    };
  }, [running, gameOver]);

  // ====== UI ======
  const groundY = VIRTUAL_H - GROUND_HEIGHT;
  const playerX = 52;

  useEffect(() => {
    const tips = [
      "Tap untuk lompat",
      "Tekan Space di keyboard",
      "Hindari rintangan untuk skor",
      "Tekan ▶ Mulai untuk bermain",
    ];
    let i = 0;
    const id = setInterval(() => {
      setHint(tips[i % tips.length]);
      i++;
    }, 2000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="w-full h-screen flex items-center justify-center bg-gradient-to-b from-slate-900 to-slate-800 text-white">
      <div className="w-full max-w-sm aspect-[9/16] relative shadow-2xl rounded-2xl overflow-hidden border border-white/10" ref={containerRef}>
        {/* World (diskalakan) */}
        <div
          className="absolute left-1/2 top-1/2 origin-top-left"
          style={{
            width: 360,
            height: 640,
            transform: `translate(-50%, -50%) scale(${scale})`,
          }}
        >
          {/* Background */}
          <div className="absolute inset-0 bg-gradient-to-b from-sky-500/40 via-sky-600/30 to-sky-800/20" />

          {/* Bintang */}
          <Stars />

          {/* Ground */}
          <div
            className="absolute left-0 right-0"
            style={{ top: groundY, height: 24, background: "linear-gradient(0deg,#0ea5e9,#0369a1)" }}
          />

          {/* Player */}
          <div
            className="absolute rounded-xl shadow-lg bg-white/90 backdrop-blur-sm border border-white/50"
            style={{
              width: 40,
              height: 40,
              transform: `translate(${playerX}px, ${playerY.current}px)`,
            }}
          />

          {/* Obstacles */}
          {obstacles.current.map((o) => (
            <div
              key={o.id}
              className="absolute bg-emerald-400/90 border border-emerald-900/30 shadow-md rounded"
              style={{
                width: o.w,
                height: o.h,
                transform: `translate(${o.x}px, ${640 - 24 - o.h}px)`,
              }}
            />
          ))}

          {/* HUD */}
          <div className="absolute left-0 right-0 top-0 p-3 flex items-center justify-between text-xs">
            <div className="flex items-center gap-2">
              <Badge>Skor: {score}</Badge>
              <Badge>Terbaik: {best}</Badge>
              <Badge>Kecepatan: {Math.round(speedRef.current)}</Badge>
            </div>
            <div className="flex items-center gap-2">
              {!running && !gameOver && (
                <button
                  className="px-3 py-1 rounded-xl bg-white/90 text-sky-700 font-semibold shadow hover:bg-white"
                  onClick={startGame}
                >
                  ▶ Mulai
                </button>
              )}
              {running && (
                <button
                  className="px-3 py-1 rounded-xl bg-white/90 text-slate-700 font-semibold shadow hover:bg-white"
                  onClick={() => setRunning(false)}
                >
                  ❚❚ Jeda
                </button>
              )}
            </div>
          </div>

          {/* Overlay: Start / Game Over */}
          {!running && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-slate-900/40 backdrop-blur-sm select-none">
              <h1 className="text-2xl font-bold tracking-tight">Tap to Jump</h1>
              <p className="text-white/80 mt-1">{hint}</p>
              {gameOver ? (
                <div className="mt-4">
                  <p className="text-sm text-white/80">Skor kamu</p>
                  <p className="text-4xl font-extrabold mt-1">{score}</p>
                  <button
                    className="mt-4 px-4 py-2 rounded-2xl bg-emerald-400 text-emerald-950 font-semibold shadow hover:brightness-110"
                    onClick={startGame}
                  >
                    Main lagi
                  </button>
                </div>
              ) : (
                <button
                  className="mt-4 px-4 py-2 rounded-2xl bg-white text-slate-900 font-semibold shadow hover:brightness-110"
                  onClick={startGame}
                >
                  ▶ Mulai
                </button>
              )}
              <p className="text-[11px] text-white/60 mt-4">Tips: Tap di mana saja untuk lompat. Hindari balok hijau.</p>
            </div>
          )}
        </div>
      </div>

      {/* Panel Kanan: Kontrol & Info (tersembunyi di mobile) */}
      <div className="hidden md:block ml-6 w-72">
        <div className="p-4 rounded-2xl bg-white/5 border border-white/10 shadow">
          <h2 className="text-lg font-semibold">Cara Main</h2>
          <ul className="mt-2 list-disc list-inside text-white/80 text-sm space-y-1">
            <li>Tap layar (atau tekan Space) untuk lompat.</li>
            <li>Hindari rintangan hijau untuk menambah skor.</li>
            <li>Kecepatan akan meningkat seiring waktu.</li>
          </ul>
          <div className="mt-4 text-sm text-white/70">
            <p>
              <span className="font-semibold">Kustomisasi:</span> Ubah konstanta di bagian atas file untuk menyesuaikan
              gravitasi, kekuatan lompatan, dan frekuensi rintangan.
            </p>
            <p className="mt-2">
              <span className="font-semibold">Catatan Mobile:</span> Komponen ini berskala otomatis dan siap dimainkan di
              layar ponsel (aspek 9:16).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="px-2 py-1 rounded-lg bg-black/30 border border-white/10 shadow text-white/90">
      {children}
    </span>
  );
}

function Stars() {
  // Bikin bintang-bintang statis untuk latar
  const stars = useMemo(() => {
    const arr: { x: number; y: number; s: number; a: number }[] = [];
    for (let i = 0; i < 60; i++) {
      arr.push({ x: Math.random() * 360, y: Math.random() * 640, s: Math.random() * 2 + 1, a: Math.random() * 0.6 + 0.2 });
    }
    return arr;
  }, []);
  return (
    <div className="absolute inset-0">
      {stars.map((st, i) => (
        <div
          key={i}
          className="absolute rounded-full"
          style={{
            width: st.s,
            height: st.s,
            left: st.x,
            top: st.y,
            background: `rgba(255,255,255,${st.a.toFixed(2)})`,
            boxShadow: "0 0 6px rgba(255,255,255,0.4)",
          }}
        />
      ))}
    </div>
  );
}
