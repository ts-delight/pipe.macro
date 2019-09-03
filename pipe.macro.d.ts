type Resolved<T> =
  T extends Promise<infer R>
  ? R
  : T;

type AnyFn = (...args: any) => any;

// https://github.com/microsoft/TypeScript/issues/33196#issuecomment-527233721
type ExtractKeys<T> = Extract<keyof T, string | number | symbol>;

type ThruMemberMapping<TPrimary, TSecondary> = {
  [K in ExtractKeys<TPrimary>]: TPrimary[K] extends AnyFn
  ? (...args: Parameters<TPrimary[K]>) => PipeChain<ReturnType<TPrimary[K]>, TSecondary>
  : () => PipeChain<TPrimary[K], TSecondary>;
};

type ThruChain<TPrimary, TSecondary> = {
  <TNextResult, TArgs extends any[]>(transform: (i: TPrimary, ...args: TArgs) => TNextResult, ...args: TArgs): PipeChain<TNextResult, TSecondary>;
} & ThruMemberMapping<TPrimary, TSecondary>;

type TapMemberMapping<TPrimary, TSecondary> = {
  [k in ExtractKeys<TPrimary>]: TPrimary[k] extends AnyFn
  ? (...args: Parameters<TPrimary[k]>) => PipeChain<TPrimary, TSecondary>
  : never;
}

type TapChain<TPrimary, TSecondary> = {
  (intercept: (i: TPrimary) => void): PipeChain<TPrimary, TSecondary>;
} & TapMemberMapping<TPrimary, TSecondary>;

interface PipeChain<TPrimary, TSecondary = never> {
  (): TPrimary | TSecondary;

  thru: ThruChain<TPrimary, TSecondary>;

  thruCtx<TNextResult, TArgs extends any[]>(transform: (this: TPrimary, ...args: TArgs) => TNextResult, ...args: TArgs): PipeChain<TNextResult, TSecondary>;

  bailIf(predicate: (i: TPrimary) => boolean): PipeChain<TPrimary, TSecondary | TPrimary>;
  reconcile<TResult>(reconciler?: (i: TPrimary | TSecondary) => TResult): PipeChain<TResult>

  thruEnd<TNextResult>(transform: (i: TPrimary) => TNextResult): PipeChain<TNextResult, TSecondary>;
  thruEnd<TNextResult, TArg1>(transform: (arg1: TArg1, i: TPrimary) => TNextResult, arg1: TArg1): PipeChain<TNextResult, TSecondary>;
  thruEnd<TNextResult, TArg1, TArg2>(transform: (arg1: TArg1, arg2: TArg2, i: TPrimary) => TNextResult, arg1: TArg1, arg2: TArg2): PipeChain<TNextResult, TSecondary>;
  thruEnd<TNextResult, TArg1, TArg2, TArg3>(transform: (arg1: TArg1, arg2: TArg2, arg3: TArg3, i: TPrimary) => TNextResult, arg1: TArg1, arg2: TArg2, arg3: TArg3): PipeChain<TNextResult, TSecondary>;
  thruEnd<TNextResult, TArg1, TArg2, TArg3, TArg4>(transform: (arg1: TArg1, arg2: TArg2, arg3: TArg3, arg4: TArg4, i: TPrimary) => TNextResult, arg1: TArg1, arg2: TArg2, arg3: TArg3, arg4: TArg4): PipeChain<TNextResult, TSecondary>;
  thruEnd<TNextResult, TArg1, TArg2, TArg3, TArg4, TArg5>(transform: (arg1: TArg1, arg2: TArg2, arg3: TArg3, arg4: TArg4, arg5: TArg5, i: TPrimary) => TNextResult, arg1: TArg1, arg2: TArg2, arg3: TArg3, arg4: TArg4, arg5: TArg5): PipeChain<TNextResult, TSecondary>;
  thruEnd<TNextResult>(transform: (...args: any[]) => TNextResult, ...prependedArgs: any[]): PipeChain<TNextResult, TSecondary>;

  tap: TapChain<TPrimary, TSecondary>;

  await: () => PipeChain<Resolved<TPrimary>>
}

declare function Pipe<T>(target: T): PipeChain<T>;

export = Pipe;

