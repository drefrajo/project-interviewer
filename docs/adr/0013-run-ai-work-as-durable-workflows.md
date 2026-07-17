# Run AI work as durable workflows

File analysis and Project Brief generation will run as durable Convex workflows, while an Interview Turn first commits its Client answer and pending operation before asynchronous AI work begins. Idempotent steps and persisted status allow retries, recovery, live progress, and exactly one committed next question without tying product responsiveness to a single browser request.
