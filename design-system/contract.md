# Data contracts

Components depend on these two shapes and nothing else. Change the data source or the email provider by writing a new mapping, not by editing components.

## Product (input to `ProductCard` and `EnquiryForm`)

```ts
interface Product {
  id: string | number;
  title: string;
  price?: number;     // in the currency passed to the component, default USD
  image?: string;     // absolute URL
  category?: string;  // shown as given
}
```

Map the Fake Store API (`/products`) like this, in one function at the edge of the app:

| Fake Store field | Product field |
| --- | --- |
| `id` | `id` |
| `title` | `title` |
| `price` | `price` |
| `image` | `image` |
| `category` | `category` |

Ignore `rating` (the server uses it for ranking only). List endpoints also omit `description`.

`GET /products/:id` returns the product detail shape: `Product` plus an optional `description`. The product page shows it when present and hides that section when it is missing.

```ts
interface ProductDetail extends Product {
  description?: string;  // plain text, shown as given
}
```

A future source needs only another mapper that returns `Product`.

Category links come from `GET /categories`. There is no "All" chip, and the client never derives categories from loaded products.

## EnquiryPayload (output of `EnquiryForm`)

```ts
interface EnquiryPayload {
  name: string;
  email: string;
  phone?: string;
  message: string;
  product?: { id: string | number; title: string; price?: number };
}
```

`onSubmit(payload)` must return or resolve when the enquiry has been delivered and throw or reject when it has not. Everything provider-specific (API key, template, recipient, endpoint) lives inside that function, ideally behind a server route so keys never reach the browser. Changing the email provider changes only that function. A rejection may be an `EnquiryError` carrying `fields` or a `message` to show.
