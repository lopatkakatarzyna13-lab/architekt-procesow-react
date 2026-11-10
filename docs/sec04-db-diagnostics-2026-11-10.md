# SEC-04: diagnostic investigation of local CI database

Date: 2026-11-10. Tested commit: `053b16c936e0a58e86e56091955e3f93a897f7cc`. Run: https://github.com/lopatkakatarzyna13-lab/architekt-procesow-react/actions/runs/42912150561

Earlier run https://github.com/lopatkakatarzyna13-lab/architekt-procesow-react/actions/runs/42910144768 failed because the local PostgreSQL instance temporarily reported that it was not accepting connections. The log alone does not establish why this occurred or whether it caused prior Edge errors.

On the tested commit, a disposable local stack was subjected to batches of 1, 4, 12 and 24 concurrent connections, three rounds each, both before and after the Auth/browser/Edge integration tests. Every requested connection succeeded, and the health check following each batch succeeded. Docker inspect reported the database container running with OOMKilled=false and restart count 0 at the sampled points. Docker memory samples were approximately 130–132 MiB before and 121–124 MiB after integration; these are point-in-time container readings, not peak or runner-wide memory measurements. The browser/Edge integration also passed in that run.

Conclusion: this limited test did not reproduce the failure and does not identify its root cause. It cannot exclude transient memory pressure, a PostgreSQL child-process crash, a network problem or another cause, and container restart count does not prove PostgreSQL itself never recovered internally. Failure-only diagnostics remain in CI to record container status and counts of selected PostgreSQL log patterns without publishing logs or credentials. Further reproduction and review of captured evidence are required. SEC-04 remains open; no hosted database or real customer data was used.
