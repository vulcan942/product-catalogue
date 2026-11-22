# Code style

- Prefer small, single-purpose functions and files with clear names.
- No `any`. Type external data at the boundary where it comes in.
- Handle errors explicitly. No empty catch blocks and no swallowed failures.
- Follow the existing conventions of the file you are editing. Do not reformat code you are not changing.
- Comments explain why, not what. Remove dead code and commented-out code.
- Keep dependencies minimal. Justify any new one in the change description.
- You must be able to explain every line you write. If a piece of code is not understood, simplify it.
