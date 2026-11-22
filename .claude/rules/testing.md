# Testing

- Cover the critical path: featured products, category listing, search, product detail, and the enquiry flow including its failure cases.
- Unit-test services against fake providers. Tests must not call the real Fake Store API or send real email.
- Test each provider adapter separately for mapping and error handling.
- Test API routes for validation, status codes and error shapes.
- Frontend tests check what the user sees and does, not implementation details.
- Name tests after the behaviour they check. Each test checks one thing.
- Run the full test suite and fix failures before calling any task done.
