/**
 * Contracts every presentation mode implements.
 *
 * A mode is a *skin*: it receives already-shaped view-models (domain/sections)
 * and decides how to present them. It never fetches data itself and never
 * talks to the admin API directly — inline editing goes through the shared
 * sudo/inline wrappers.
 */
import type { ComponentType, LazyExoticComponent, ReactNode } from "react";

import type { Bootstrap, ModeId, SectionKey } from "@/api/types";
import type { AnySectionModel, SectionModel } from "@/domain/sections";
import type { IconName } from "@/ui/Icon";

/** Props for one homepage section in a given mode. */
export interface SectionProps<K extends SectionKey = SectionKey> {
  model: SectionModel<K>;
  bootstrap: Bootstrap;
}

export type SectionComponents = { [K in SectionKey]: ComponentType<SectionProps<K>> };

export interface ModeViews {
  /** Wraps every public page (nav, chrome, background, mode-specific providers). */
  Layout: ComponentType<{ bootstrap: Bootstrap; children: ReactNode }>;
  Home: ComponentType<{ bootstrap: Bootstrap; sections: AnySectionModel[] }>;
  Project: ComponentType<{ bootstrap: Bootstrap; slug: string }>;
  BlogIndex: ComponentType<{ bootstrap: Bootstrap }>;
  Post: ComponentType<{ bootstrap: Bootstrap; slug: string }>;
  NotFound: ComponentType<{ bootstrap: Bootstrap }>;
}

export interface ModeDefinition {
  id: ModeId;
  label: string;
  description: string;
  icon: IconName;
  /** False while a mode is still being built — shown as "coming soon" in the switcher. */
  implemented: boolean;
  /** Runtime check (e.g. 3D requires WebGL). */
  isSupported?: () => boolean;
  /** Code-split: each mode's views are loaded only when that mode is used. */
  load: () => Promise<{ default: ModeViews }>;
}

export type LazyViews = { [K in keyof ModeViews]: LazyExoticComponent<ModeViews[K]> };
