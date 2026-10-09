/**
 * Single place where GSAP plugins are registered. Import gsap/ScrollTrigger
 * from here (not from "gsap" directly) so registration always happened.
 */
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export { gsap, ScrollTrigger };
