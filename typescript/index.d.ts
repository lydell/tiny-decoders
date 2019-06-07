// TODO: TypeScript Version: 3.0
// Waiting for https://github.com/Microsoft/dtslint/issues/137
// Remove the `--onlyTestTsNext` workaround from `npm run dtslint`.

export function boolean(value: unknown): boolean;

export function number(value: unknown): number;

export function string(value: unknown): string;

export function mixedArray(value: unknown): ReadonlyArray<unknown>;

export function mixedDict(value: unknown): { readonly [key: string]: unknown };

export function constant<
  T extends boolean | number | string | undefined | null
>(constantValue: T): (value: unknown) => T;

export function array<T>(
  decoder: (value: unknown) => T
): (value: unknown) => Array<T>;

export function dict<T>(
  decoder: (value: unknown) => T
): (value: unknown) => { [key: string]: T };

// Shamelessly stolen from:
// https://github.com/nvie/decoders/blob/1dc791f1df8e33110941baf5820f99318660f60f/src/object.d.ts#L4-L9
export type ExtractDecoderType<T> = T extends ((value: unknown) => infer V)
  ? V
  : never;

export function group<T extends { [key: string]: (value: unknown) => unknown }>(
  mapping: T
): (value: unknown) => { [key in keyof T]: ExtractDecoderType<T[key]> };

export function record<
  T extends { [key: string]: (value: unknown) => unknown }
>(
  mapping: T
): (value: unknown) => { [key in keyof T]: ExtractDecoderType<T[key]> };

export function field<T>(
  key: string | number,
  decoder: (value: unknown) => T
): (value: unknown) => T;

export function fieldDeep<T>(
  keys: Array<string | number>,
  decoder: (value: unknown) => T
): (value: unknown) => T;

export function optional<T>(
  decoder: (value: unknown) => T
): (value: unknown) => T | undefined;
export function optional<T, U>(
  decoder: (value: unknown) => T,
  defaultValue: U
): (value: unknown) => T | U;

export function map<T, U>(
  decoder: (value: unknown) => T,
  fn: (value: T) => U
): (value: unknown) => U;

export function andThen<T, U>(
  decoder: (value: unknown) => T,
  fn: (value: T) => (value: unknown) => U
): (value: unknown) => U;

export function fieldAndThen<T, U>(
  key: string | number,
  decoder: (value: unknown) => T,
  fn: (value: T) => (value: unknown) => U
): (value: unknown) => U;

export function either<T, U>(
  decoder1: (value: unknown) => T,
  decoder2: (value: unknown) => U
): (value: unknown) => T | U;

export function lazy<T>(fn: () => (value: unknown) => T): (value: unknown) => T;

export function repr(
  value: unknown,
  options?: {
    key?: string | number;
    recurse?: boolean;
    maxArrayChildren?: number;
    maxObjectChildren?: number;
  }
): string;
