export type Settings = { groupSize: number; threshold: number; duration: number; difficulty: 'easy' | 'normal' | 'hard' };
export type Course = '1' | '2' | '3' | '4' | '5' | 'vocabulary';
export type Pair = { word: string; code: string };
export type Learning = { course: Course; word: string; covered: number; streak: number; mistakes: number; lastAnsweredAt: number | null; mastered: number };
export type Progress = { course: Course; cursor: number; orderedGroupWords: string[] };
export type Snapshot = { settings: Settings; supplemental: (Pair & {level:number})[]; vocabulary: Pair[]; learning: Learning[]; courseProgress: Progress[] };
export type ErrorCode = 'VALIDATION' | 'CONFLICT' | 'IO' | 'MIGRATION' | 'CANCELLED';
export type Result<T> = {ok:true; value:T; revision:number} | {ok:false; error:{code:ErrorCode; message:string; retryable:boolean}};
export type Write<T> = {requestId:string; expectedRevision:number; value:T};
export type Changed = {revision:number; requestId:string; affectedCourses:Course[]; addedPairs:Pair[]; removedPairs:Pair[]; codeReplacements:unknown[]; removedCourseWords:unknown[]};
export interface Bridge {
  getSnapshot(): Promise<Result<Snapshot>>;
  getResources(): Promise<Result<{level:number; bytes:number}[]>>;
  updateSettings(request:Write<Settings>):Promise<Result<Settings>>;
  openMain():Promise<Result<null>>;
  openText():Promise<Result<null>>;
  quit():Promise<Result<null>>;
  onChanged(callback:(event:Changed)=>void):()=>void;
  onPause(callback:()=>void):()=>void;
}
export const defaults:Settings = {groupSize:20, threshold:3, duration:1, difficulty:'normal'};
