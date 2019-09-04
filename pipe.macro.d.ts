type Resolved<T> =
  T extends Promise<infer R>
  ? R
  : T;

type AnyFn = (...args: any) => any;

// https://github.com/microsoft/TypeScript/issues/33196#issuecomment-527233721
type ExtractKeys<T> = Extract<keyof T, string | number | symbol>;

type ThruMemberMapping<TPrimary, TSecondary, TInput> = {
  [K in ExtractKeys<TPrimary>]: TPrimary[K] extends AnyFn
  ? (...args: Parameters<TPrimary[K]>) => PipeChain<ReturnType<TPrimary[K]>, TSecondary, TInput>
  : () => PipeChain<TPrimary[K], TSecondary, TInput>;
};

type ThruChain<TPrimary, TSecondary, TInput> = {
  <TNextResult, TArgs extends any[]>(transform: (i: TPrimary, ...args: TArgs) => TNextResult, ...args: TArgs): PipeChain<TNextResult, TSecondary, TInput>;
} & ThruMemberMapping<TPrimary, TSecondary, TInput>;

type TapMemberMapping<TPrimary, TSecondary, TInput> = {
  [k in ExtractKeys<TPrimary>]: TPrimary[k] extends AnyFn
  ? (...args: Parameters<TPrimary[k]>) => PipeChain<TPrimary, TSecondary, TInput>
  : never;
}

type TapChain<TPrimary, TSecondary, TInput> = {
  (intercept: (i: TPrimary) => void): PipeChain<TPrimary, TSecondary, TInput>;
} & TapMemberMapping<TPrimary, TSecondary, TInput>;

type Boxed<T> = { t: T };

interface PipeChain<TPrimary, TSecondary = never, TInput = never> {
  (): Boxed<TInput> extends Boxed<never>
    ? TPrimary | TSecondary
    : (input: TInput) => TPrimary | TSecondary;

  thru: ThruChain<TPrimary, TSecondary, TInput>;

  thruCtx<TNextResult, TArgs extends any[]>(transform: (this: TPrimary, ...args: TArgs) => TNextResult, ...args: TArgs): PipeChain<TNextResult, TSecondary, TInput>;

  bailIf(predicate: (i: TPrimary) => boolean): PipeChain<TPrimary, TSecondary | TPrimary, TInput>;
  reconcile<TResult>(reconciler?: (i: TPrimary | TSecondary) => TResult): PipeChain<TResult, never, TInput>

  thruEnd<TNextResult>(transform: (i: TPrimary) => TNextResult): PipeChain<TNextResult, TSecondary, TInput>;
  thruEnd<TNextResult, TArg1>(transform: (arg1: TArg1, i: TPrimary) => TNextResult, arg1: TArg1): PipeChain<TNextResult, TSecondary, TInput>;
  thruEnd<TNextResult, TArg1, TArg2>(transform: (arg1: TArg1, arg2: TArg2, i: TPrimary) => TNextResult, arg1: TArg1, arg2: TArg2): PipeChain<TNextResult, TSecondary, TInput>;
  thruEnd<TNextResult, TArg1, TArg2, TArg3>(transform: (arg1: TArg1, arg2: TArg2, arg3: TArg3, i: TPrimary) => TNextResult, arg1: TArg1, arg2: TArg2, arg3: TArg3): PipeChain<TNextResult, TSecondary, TInput>;
  thruEnd<TNextResult, TArg1, TArg2, TArg3, TArg4>(transform: (arg1: TArg1, arg2: TArg2, arg3: TArg3, arg4: TArg4, i: TPrimary) => TNextResult, arg1: TArg1, arg2: TArg2, arg3: TArg3, arg4: TArg4): PipeChain<TNextResult, TSecondary, TInput>;
  thruEnd<TNextResult, TArg1, TArg2, TArg3, TArg4, TArg5>(transform: (arg1: TArg1, arg2: TArg2, arg3: TArg3, arg4: TArg4, arg5: TArg5, i: TPrimary) => TNextResult, arg1: TArg1, arg2: TArg2, arg3: TArg3, arg4: TArg4, arg5: TArg5): PipeChain<TNextResult, TSecondary, TInput>;
  thruEnd<TNextResult>(transform: (...args: any[]) => TNextResult, ...prependedArgs: any[]): PipeChain<TNextResult, TSecondary, TInput>;

  tap: TapChain<TPrimary, TSecondary, TInput>;

  await: () => PipeChain<Resolved<TPrimary>, never, TInput>
}

declare function Pipe<T>(): PipeChain<T, never, T>;
declare function Pipe<T>(target: T): PipeChain<T, never, never>;

export = Pipe;
