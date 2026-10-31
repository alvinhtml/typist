export type Settings = { groupSize: number; threshold: number; duration: number; difficulty: 'easy' | 'normal' | 'hard' };
export type Course = '1' | '2' | '3' | '4' | '5' | 'vocabulary';
export type Pair = { word: string; code: string };
export type Learning = { course: Course; word: string; covered: number; streak: number; mistakes: number; lastAnsweredAt: number | null; mastered: number };
export type Progress = { course: Course; cursor: number; orderedGroupWords: string[] };
export type Snapshot = { settings: Settings; supplemental: (Pair & {level:number})[]; vocabulary: Pair[]; learning: Learning[]; courseProgress: Progress[] };
export type ErrorCode = 'VALIDATION' | 'CONFLICT' | 'IO' | 'MIGRATION' | 'CANCELLED';
export type Result<T> = {ok:true; value:T; revision:number} | {ok:false; error:{code:ErrorCode; message:string; retryable:boolean}};
export type Write<T> = {requestId:string; expectedRevision:number; value:T};
export type Changed = {revision:number; requestId:string; affectedCourses:Course[]; addedPairs:Pair[]; removedPairs:Pair[]; codeReplacements:CodeReplacement[]; removedCourseWords:RemovedCourseWord[]};
export interface Bridge {
  getSnapshot(): Promise<Result<Snapshot>>;
  getResources(): Promise<Result<{level:number; bytes:number}[]>>;
  getCourse(request:{course:Course;offset:number;limit:number}):Promise<Result<{total:number;items:CourseWord[]}>>;
  mutateSupplemental(request:Write<SupplementalOperation[]>):Promise<Result<SupplementalChange>>;
  addVocabularyText(request:Write<string>):Promise<Result<TextAddition>>;
  deleteVocabulary(request:Write<VocabularySelection>):Promise<Result<VocabularyChange>>;
  updateSettings(request:Write<Settings>):Promise<Result<Settings>>;
  openMain():Promise<Result<null>>;
  openText():Promise<Result<null>>;
  quit():Promise<Result<null>>;
  onChanged(callback:(event:Changed)=>void):()=>void;
  onPause(callback:()=>void):()=>void;
}
export const defaults:Settings = {groupSize:20, threshold:3, duration:1, difficulty:'normal'};

export type Entry = Pair & {level:number};
export type SupplementalOperation = {kind:'add';entry:Entry}|{kind:'update';oldPair:Pair;entry:Entry}|{kind:'delete';pair:Pair};
export type CourseWord = {word:string; codes:string[]};
export type RemovedCourseWord = {course:Course;word:string};
export type CodeReplacement = {word:string;oldCode:string;newCode:string};
export type VocabularyChange = {addedPairs:Pair[];removedPairs:Pair[];codeReplacements:CodeReplacement[];removedCourseWords:RemovedCourseWord[];affectedCourses:Course[]};
export type TextAddition = VocabularyChange & {duplicateOccurrences:number;unknownDistinct:string[]};
export type SupplementalChange = VocabularyChange & {merged:number;addedEntries:Entry[];removedEntries:Entry[]};
export type VocabularySelection = {pairs:Pair[];words:string[]};
