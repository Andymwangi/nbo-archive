"use client";

import { useSyncExternalStore } from "react";

import { type Countdown, countdown } from "@/lib/format";

/*
  One shared one-second clock for every countdown on the page. The server snapshot is null, so
  server HTML and the first client render agree and the ticking starts after hydration.
*/
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | undefined;
let nowSeconds = 0;

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (timer === undefined) {
    nowSeconds = Math.floor(Date.now() / 1000);
    timer = setInterval(() => {
      nowSeconds = Math.floor(Date.now() / 1000);
      listeners.forEach((notify) => notify());
    }, 1000);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0 && timer !== undefined) {
      clearInterval(timer);
      timer = undefined;
    }
  };
}

const getSnapshot = () => nowSeconds || Math.floor(Date.now() / 1000);
const getServerSnapshot = () => null;

/** Time left until `target`, or null before hydration. `done` turns true once it reaches zero. */
export function useCountdown(target: Date): (Countdown & { done: boolean }) | null {
  const now = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  if (now === null) return null;
  const left = countdown(target, new Date(now * 1000));
  const done = left.days + left.hours + left.minutes + left.seconds === 0;
  return { ...left, done };
}
