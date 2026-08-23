/** Globals supplied by optional browser integrations used by node packs. */
declare function clamp(value: number, min: number, max: number): number;
declare const SillyClient: any;
declare const AudioSynth: any;
declare const GL: any;
declare const LS: any;
declare const LGraph: any;
declare const LGraphCanvas: any;
declare const LGraphTexture: any;
declare const LiteGraph: any;
declare const Mesh: any;
declare const MidiParser: any;
declare const Shader: any;
declare const gl: any;
declare const mat4: any;
declare const quat: any;
declare const vec2: any;
declare const vec3: any;
declare const vec4: any;
declare const DEG2RAD: number;
declare function colorToString(color: ArrayLike<number>): string;
declare function cloneCanvas(canvas: HTMLCanvasElement): HTMLCanvasElement;
declare function createCanvas(width?: number, height?: number): HTMLCanvasElement;
declare const curve_editor: any;
declare function getTime(): number;
declare function hex2num(color: string): number[];
declare function isPowerOfTwo(value: number): boolean;
declare function polarToCartesian(...args: any[]): any;
declare function showElement(element: HTMLElement): void;
declare function typedArrayToArray(value: ArrayLike<number>): number[];

interface Window {
    webkitAudioContext?: typeof AudioContext;
    LS?: any;
    gl?: any;
}

interface Navigator {
    getUserMedia?: (...args: any[]) => any;
}
