// TODO: TypeScript Version: 3.0
// Waiting for https://github.com/Microsoft/dtslint/issues/137
// Remove the `--onlyTestTsNext` workaround from `npm run dtslint`.

export type Decoder<T> = (value: unknown, errors?: Array<string>) => T;

export function boolean(value: unknown): boolean;

export function number(value: unknown): number;

export function string(value: unknown): string;

export function constant<
  T extends boolean | number | string | undefined | null
>(constantValue: T): (value: unknown) => T;

export function mixedArray(value: unknown): ReadonlyArray<unknown>;

export function mixedDict(value: unknown): { readonly [key: string]: unknown };

export function array<T, U = T>(
  decoder: Decoder<T>,
  mode?: "throw" | "skip" | { default: U }
): Decoder<Array<T | U>>;

export function dict<T, U = T>(
  decoder: Decoder<T>,
  mode?: "throw" | "skip" | { default: U }
): Decoder<{ [key: string]: T | U }>;

export function fields<T>(
  callback: (
    field: <U, V = U>(
      key: string | number,
      decoder: Decoder<U>,
      mode?: "throw" | { default: V }
    ) => U | V,
    fieldError: (key: string | number, message: string) => TypeError,
    obj: { readonly [key: string]: unknown },
    errors?: Array<string>
  ) => T
): Decoder<T>;

export function pair<T1, T2>(
  decoder1: Decoder<T1>,
  decoder2: Decoder<T2>
): Decoder<[T1, T2]>;

export function triple<T1, T2, T3>(
  decoder1: Decoder<T1>,
  decoder2: Decoder<T2>,
  decoder3: Decoder<T3>
): Decoder<[T1, T2, T3]>;

export function autoRecord<T>(
  mapping: { [key in keyof T]: Decoder<T[key]> }
): Decoder<T>;

export function deep<T>(
  path: Array<string | number>,
  decoder: Decoder<T>
): Decoder<T>;

export function optional<T>(decoder: Decoder<T>): Decoder<T | undefined>;
export function optional<T, U>(
  decoder: (value: unknown) => T,
  defaultValue: U
): (value: unknown) => T | U;

export function map<T, U>(
  decoder: Decoder<T>,
  fn: (value: T, errors?: Array<string>) => U
): Decoder<U>;

export function either<T, U>(
  decoder1: Decoder<T>,
  decoder2: Decoder<U>
): Decoder<T | U>;

export function lazy<T>(callback: () => Decoder<T>): Decoder<T>;

export const repr: {
  (
    value: unknown,
    options?: {
      recurse?: boolean;
      maxArrayChildren?: number;
      maxObjectChildren?: number;
      maxLength?: number;
      recurseMaxLength?: number;
    }
  ): string;
  sensitive: boolean;
};
