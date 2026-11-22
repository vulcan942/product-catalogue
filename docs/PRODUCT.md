# Product: Product Catalogue MVP

## Summary

A web product catalogue where customers browse, search and view products, then submit an enquiry for items they want. There is no cart or checkout. The sales team receives each enquiry by email and follows up.

This is a proof of concept the entrepreneur can interact with to firm up their vision. It is also the **foundation for the real product**, not a throwaway prototype.

## Goals

* Give the entrepreneur something clickable to react to, quickly.
* Turn browsing into sales leads through the enquiry flow.
* Build a base that can grow. The product data source, the look and feel, and the email provider are all expected to change.

## Non-goals (for the MVP)

* Checkout, payments, user accounts, or order management.
* Real product metadata. Fake Store API data is acceptable for now.
* Final branding. Creative work is in progress elsewhere, so keep styling simple and easy to replace.
* Admin or CMS tooling.

## Users


| User         | Need                                                                                    |
| ------------ | --------------------------------------------------------------------------------------- |
| Customer     | Find a product, see its details, and ask the business about it.                         |
| Sales team   | Receive enquiries with the customer's contact details and the product they asked about. |
| Entrepreneur | Click through a working PoC and shape the vision.                                       |

## Features and acceptance criteria

### 1. Home page

```
GIVEN I have chosen 5 products to be "top rated"
WHEN I am viewing the home page
THEN I see those 5 featured products
```

* The 5 featured products are chosen, not computed. The selection must be easy to change.
* Each product appears as a tile that links to its product page.

### 2. Category page

```
GIVEN my products are organised into categories
WHEN I click on a category link
THEN I see top rated products for that category
  AND I see additional products in that category
```

* Category links are reachable from the home page and site navigation.
* The page shows a top-rated section first, then the remaining products in that category.

### 3. Search

```
GIVEN I am looking for a specific product
  AND I have entered a search term in the search bar
WHEN I click the search button
THEN I only see products that have text matching that search term
```

* The search bar is available on every page.
* Results contain only products whose text matches the term.
* An empty result set shows a clear "no results" state.

### 4. Product page

```
GIVEN I am browsing the products
  AND I want to see more details about a specific product
WHEN I click on a product tile
THEN I see the product details page
```

* Shows the product's full details and an **Enquire** button.

### 5. Enquiry

```
GIVEN I am viewing a product
  AND I am interested in a product
  AND I click on the Enquire button
  AND I complete the subsequent form with my contact details
WHEN I submit the form
THEN the sales inbox will receive an email
  AND the customer will see a "Thank you" message
```

* The email to sales includes the customer's contact details and which product the enquiry is about.
* The customer sees the thank-you confirmation after submitting.
* Invalid or incomplete forms are rejected with clear messages.

## Product principles

* **Evolvable over feature-rich.** The product data source, the look and feel, and the email provider must each be replaceable without reworking the others.
* **Critical path first.** Home, category, search, product and enquiry come before anything else.

## Assumptions

The acceptance criteria leave gaps. These are working assumptions, not requirements.


| Area                | Assumption                                                                                                               |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Top rated selection | The 5 home-page products are a configured list of product IDs. The category page's "top rated" ranks products by rating. |
| Categories          | Taken from the product data source (Fake Store API).                                                                     |
| "Text matching"     | Case-insensitive match against product title and description.                                                            |
| Enquiry fields      | Name, email and message are required. Phone is optional.                                                                 |
| Enquiry email       | Sent to a configurable sales address.                                                                                    |
| Pagination          | Not needed at this data size But we will be adding pagination for future proofing.                                       |
