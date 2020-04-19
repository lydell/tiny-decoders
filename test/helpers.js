// @flow strict

// If Jest is having trouble with indentation in:
//
//     expect(() => fn()).toThrowErrorMatchingInlineSnapshot();
//
// Then change to:
//
//     expect(thrownError(() => fn())).toMatchInlineSnapshot();
export function thrownError(fn: () => mixed): string {
  try {
    fn();
    return "Received function did not throw";
  } catch (error) {
    return error.message;
  }
}
