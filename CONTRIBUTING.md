# Contributing to Health

Thank you for helping build Health. The project is at an early planning stage,
so clear problem statements and small, reviewable changes are especially
valuable.

## Before contributing

- Search existing issues before opening a new one.
- Use the provided issue form for bug reports or feature proposals.
- Do not use a public issue for a suspected vulnerability. Follow
  [SECURITY.md](SECURITY.md) instead.
- Follow the [Code of Conduct](CODE_OF_CONDUCT.md).

The product requirements are not yet defined. Discuss substantial product or
architecture changes in an issue before investing in an implementation.

## Pull requests

Keep each pull request focused on one behavior or documentation concern. In the
description:

- explain the problem and the chosen approach;
- identify whether the change affects Wear OS, watchOS, shared logic, or more
  than one platform;
- describe relevant permissions, sensor access, background behavior, and
  privacy implications;
- include tests when executable code is introduced, or explain why a test is
  not applicable;
- update affected documentation.

Build instructions will be added with the first working application components.
Until then, use the validation appropriate to the files you change and report
exactly what you ran.

## Sensitive information

Never commit signing certificates, App Store or Google Play credentials, API
keys, access tokens, production configuration, personal health information, or
other user data. Remove sensitive values from logs and screenshots before
attaching them to an issue or pull request.

By contributing, you agree that your contributions are licensed under the
project's [Apache License 2.0](LICENSE).
