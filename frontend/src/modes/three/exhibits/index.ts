/** Exhibit registry: the only place that maps a catalogue id to its three.js builder. */
import type { ExhibitId } from "./catalog";
import { createCudaExhibit } from "./cuda";
import { createHardwareExhibit } from "./hardware";
import { createTransformerExhibit } from "./transformer";
import type { ExhibitFactory } from "./types";

export const EXHIBIT_FACTORIES: Record<ExhibitId, ExhibitFactory> = {
  hardware: createHardwareExhibit,
  cuda: createCudaExhibit,
  transformer: createTransformerExhibit,
};
