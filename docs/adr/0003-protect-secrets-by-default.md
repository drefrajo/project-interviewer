# Protect secrets by default

Shared Resources may contain labeled links, non-secret notes, usernames, and account identifiers, but never passwords, API keys, tokens, or other secrets. File Processing detects and redacts suspected secrets from outbound AI analysis by default without blocking upload; an uploader may explicitly and auditably override that protection after being warned that the unredacted content will be disclosed to configured AI providers. Dedicated password managers remain the intended way to share credentials.
