import { chain, Decoder, fields, fieldsAuto, number, string } from "..";

test("adding extra fields to records", () => {
  // Want to add an extra field to a record, that doesn’t look at the input at
  // all?
  type Product = {
    name: string;
    price: number;
    version: number;
  };

  const data: unknown = { name: "Comfortable Bed", price: 10e3 };

  // It’s easy to do with `fields`.
  const productDecoder1 = fields(
    (field): Product => ({
      name: field("name", string),
      price: field("price", number),
      version: 1,
    })
  );

  expect(productDecoder1(data)).toMatchInlineSnapshot(`
    Object {
      "name": "Comfortable Bed",
      "price": 10000,
      "version": 1,
    }
  `);

  // If you use `fieldsAuto`, one way is to add a decoder that always succeeds
  // (a function that ignores its input and always returns the same value).
  const productDecoder2 = fieldsAuto<Product>({
    name: string,
    price: number,
    version: () => 1,
  });

  expect(productDecoder2(data)).toEqual(productDecoder1(data));

  // If you like, you can define this helper function:
  const always =
    <T>(value: T) =>
    (): T =>
      value;

  const productDecoder3 = fieldsAuto<Product>({
    name: string,
    price: number,
    version: always(1),
  });

  expect(productDecoder3(data)).toEqual(productDecoder2(data));

  // Finally, you can do it with `chain`.
  const productDecoder4: Decoder<Product> = chain(
    fieldsAuto({
      name: string,
      price: number,
    }),
    (props) => ({ ...props, version: 1 })
  );

  expect(productDecoder4(data)).toEqual(productDecoder3(data));
});
