/**
 * useBeatPlayer — the workout-music engine (expo-audio wrapper).
 *
 * One looping AudioPlayer instance, managed imperatively so track changes
 * reuse the same player (replace) instead of re-creating native objects.
 * Every native call is defensive: audio must never crash a workout.
 *
 * Play / pause / loop / next / volume / mute — with room to grow (queueing,
 * crossfade) behind the same surface.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from "expo-audio";
import { BEATS, BEAT_BY_ID, nextBeatId } from "../data/beatMeta";
import { BEAT_SOURCES } from "../data/beatSources";
import type { BeatMeta } from "../types";

export interface UseBeatPlayerOptions {
  /** Track to load first (falls back to the catalog's first track). */
  initialBeatId?: string;
  initialVolume?: number; // 0..1
  /** Start playing as soon as the hook mounts. */
  autoplay?: boolean;
}

export interface UseBeatPlayer {
  beat: BeatMeta;
  playing: boolean;
  volume: number;
  muted: boolean;
  play: () => void;
  pause: () => void;
  toggle: () => void;
  /** Advance to the next track in the catalog (keeps playing state). */
  next: () => void;
  selectBeat: (id: string) => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
}

let audioModeReady = false;
async function ensureAudioMode(): Promise<void> {
  if (audioModeReady) return;
  audioModeReady = true;
  try {
    // Keep music under the OS silent switch's control is wrong for a workout —
    // people flip silent and still expect their session music.
    await setAudioModeAsync({ playsInSilentMode: true });
  } catch {
    // non-fatal: playback still works with platform defaults
  }
}

export function useBeatPlayer(options: UseBeatPlayerOptions = {}): UseBeatPlayer {
  const [beatId, setBeatId] = useState<string>(
    options.initialBeatId && BEAT_BY_ID.has(options.initialBeatId)
      ? options.initialBeatId
      : BEATS[0].id,
  );
  const [playing, setPlaying] = useState(false);
  const [volume, setVolumeState] = useState(clamp01(options.initialVolume ?? 0.8));
  const [muted, setMuted] = useState(false);

  const playerRef = useRef<AudioPlayer | null>(null);
  // Mirrors for values needed inside callbacks without re-creating them.
  const playingRef = useRef(false);
  const volumeRef = useRef(volume);
  const mutedRef = useRef(false);

  /** Create (or reuse) the native player for the given track. */
  const loadBeat = useCallback((id: string) => {
    const source = BEAT_SOURCES[id];
    if (source == null) return;
    try {
      if (playerRef.current) {
        playerRef.current.replace(source);
      } else {
        const p = createAudioPlayer(source);
        p.loop = true;
        playerRef.current = p;
      }
      const p = playerRef.current;
      if (p) {
        p.loop = true;
        p.volume = mutedRef.current ? 0 : volumeRef.current;
        if (playingRef.current) p.play();
      }
    } catch (e) {
      console.warn("BeatPlayer.loadBeat:", e);
    }
  }, []);

  // Mount: set the audio mode + preload the initial track. Unmount: release.
  useEffect(() => {
    void ensureAudioMode();
    loadBeat(beatId);
    if (options.autoplay) {
      playingRef.current = true;
      setPlaying(true);
      try {
        playerRef.current?.play();
      } catch {}
    }
    return () => {
      try {
        playerRef.current?.remove();
      } catch {}
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const play = useCallback(() => {
    playingRef.current = true;
    setPlaying(true);
    try {
      playerRef.current?.play();
    } catch {}
  }, []);

  const pause = useCallback(() => {
    playingRef.current = false;
    setPlaying(false);
    try {
      playerRef.current?.pause();
    } catch {}
  }, []);

  const toggle = useCallback(() => {
    if (playingRef.current) pause();
    else play();
  }, [pause, play]);

  const selectBeat = useCallback(
    (id: string) => {
      if (!BEAT_BY_ID.has(id)) return;
      setBeatId(id);
      loadBeat(id);
    },
    [loadBeat],
  );

  const next = useCallback(() => {
    setBeatId((current) => {
      const nid = nextBeatId(current);
      loadBeat(nid);
      return nid;
    });
  }, [loadBeat]);

  const setVolume = useCallback((v: number) => {
    const vol = clamp01(v);
    volumeRef.current = vol;
    setVolumeState(vol);
    try {
      if (playerRef.current && !mutedRef.current) playerRef.current.volume = vol;
    } catch {}
  }, []);

  const toggleMute = useCallback(() => {
    mutedRef.current = !mutedRef.current;
    setMuted(mutedRef.current);
    try {
      if (playerRef.current)
        playerRef.current.volume = mutedRef.current ? 0 : volumeRef.current;
    } catch {}
  }, []);

  return {
    beat: BEAT_BY_ID.get(beatId) ?? BEATS[0],
    playing,
    volume,
    muted,
    play,
    pause,
    toggle,
    next,
    selectBeat,
    setVolume,
    toggleMute,
  };
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}
