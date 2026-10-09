/**
 * Sound on/off. The preference is saved by PreferencesProvider ("pf.sound", off by default).
 * Turning sound ON happens in the click handler, since browsers only start audio from a user gesture.
 * If the saved preference is "on" at page load, the first click / key press anywhere unlocks it.
 */
import { useEffect } from "react";

import { usePreferences } from "@/lib/preferences/PreferencesProvider";
import { Button } from "@/ui/Button";

import { sound } from "./synth";

/** Keeps the shared synth in step with the preference, and pauses it while the tab is hidden. */
export function useSoundSync() {
  const { sound: wanted } = usePreferences();

  useEffect(() => {
    if (!wanted) {
      sound.disable();
      return;
    }
    // Saved "on" from an earlier visit: wait for the first gesture to start audio.
    if (sound.enabled) return;
    const unlock = () => {
      sound.enable();
      window.removeEventListener("pointerdown", unlock, true);
      window.removeEventListener("keydown", unlock, true);
    };
    window.addEventListener("pointerdown", unlock, true);
    window.addEventListener("keydown", unlock, true);
    return () => {
      window.removeEventListener("pointerdown", unlock, true);
      window.removeEventListener("keydown", unlock, true);
    };
  }, [wanted]);

  useEffect(() => {
    const onVisibility = () => sound.setHidden(document.hidden);
    document.addEventListener("visibilitychange", onVisibility);
    return () => document.removeEventListener("visibilitychange", onVisibility);
  }, []);
}

export function SoundToggle() {
  const { sound: on, setSound } = usePreferences();
  if (!sound.supported) return null;
  return (
    <Button
      variant="ghost"
      iconOnly
      icon={on ? "sound" : "mute"}
      aria-label={on ? "Turn sound off" : "Turn sound on"}
      aria-pressed={on}
      onClick={() => {
        if (on) {
          setSound(false);
          return;
        }
        if (sound.enable()) {
          setSound(true);
          sound.tick();
        }
      }}
    />
  );
}
