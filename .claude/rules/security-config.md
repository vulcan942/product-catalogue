# Security and configuration

- Never commit secrets. All configuration comes from environment variables.
- Keep `.env.example` current with every variable the app reads, using safe placeholder values. Keep `.env` in `.gitignore`.
- Read and validate configuration once at startup, and fail fast with a clear message if something required is missing.
- Never trust client input. Validate and sanitise on the server.
- Set CORS to the known client origin only.
- Do not add dependencies that need a paid service or an account.
- Any infrastructure files must be compatible with AWS.
