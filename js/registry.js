// ============================================================================
// registry.js — the list of programs, and nothing else.
//
// Both program.js and state.js need this, and state.js is imported by almost
// everything, so keeping it in its own leaf module is what stops the import
// graph from going circular.
// ============================================================================
import p15 from './programs/p15.js';
import p12 from './programs/p12.js';
import p12plus from './programs/p12plus.js';

export const PROGRAM_LIST = [p15, p12, p12plus];
export const PROGRAMS = Object.fromEntries(PROGRAM_LIST.map((p) => [p.id, p]));
export const DEFAULT_PROGRAM = p15.id;
