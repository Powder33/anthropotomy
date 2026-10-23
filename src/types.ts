export type Region = 'neck' | 'shoulder' | 'chest' | 'back' | 'arm' | 'core' | 'hip' | 'thigh' | 'calf';
export type View = 'front' | 'back' | 'left' | 'right';
export type Layer = 'all' | 'superficial' | 'deep';
export interface Muscle {
  id: string; name: string; english: string; region: Region;
  layer: 'superficial' | 'deep'; view: string; summary: string;
  actions: { name: string; description: string }[];
  exercises: { name: string; description: string }[];
  tip: string; origin: string; insertion: string; reading: string; pattern: string;
}
export interface Part {
  name: string; muscleId: string | null; side: string; source: string; fmaId: string;
  vertexCount: number; indexCount: number; positions: number; normals: number; indices: number;
}
export interface ModelChunk {
  url: string; bytes: number; compressedBytes: number; sha256: string; parts: Part[];
}
export interface Manifest { muscles: ModelChunk; skeleton: ModelChunk; sourceCommit: string; }
