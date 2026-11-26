"""Summarize timestamped Docker logs without printing SQL or connection details."""
import re
import sys
from collections import Counter


EVENTS = {
    "process_signal": r"\b(?:was )?terminated by signal (\d{1,2})\b",
    "out_of_memory": r"\bout[- ]of[- ]memory\b|\boom.kill\b",
    "storage_full": r"\bno space left on device\b",
    "shared_memory": r"\bcould not (?:resize|map|create) shared memory",
    "io_error": r"\binput/output error\b",
    "connections_full": r"\btoo many (?:clients|connections)\b|remaining connection slots",
    "panic": r"\bPANIC:",
    "reinitializing": r"\breinitializing\b",
    "recovery": r"database system (?:is in recovery mode|was interrupted|was not properly shut down)",
    "unavailable": r"database system is not accepting connections",
    "ready": r"database system is ready to accept connections",
}


def process_kind(message):
    # Classify the server's message prefix. Never echo a worker name or a statement.
    prefix = re.search(r'\bLOG:\s+(.*?)\s+\(PID \d+\)\s+(?:was )?terminated by signal\b', message, re.I)
    if not prefix:
        return "unknown"
    name = prefix[1].lower()
    if name.startswith('background worker '):
        return "background_worker"
    return {
        "server process": "server_process",
        "autovacuum worker process": "autovacuum_worker",
        "checkpointer process": "checkpointer",
        "startup process": "startup",
    }.get(name, "unknown")


def summarize(lines):
    counts = Counter()
    for line in lines:
        stamp = re.match(r"^(\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(?:\.\d+)?Z) ", line)
        if not stamp:
            continue
        for event, pattern in EVENTS.items():
            match = re.search(pattern, line, re.IGNORECASE)
            if match:
                key = f"process_signal_{match[1]}" if event == "process_signal" else event
                counts[key] += 1
                if counts[key] == 1:
                    print("DB_FIRST_EVENT", stamp[1], key)
                    if event == "process_signal":
                        print("DB_PROCESS_KIND", process_kind(line))
    print("DB_EVENT_COUNTS", " ".join(f"{key}={n}" for key, n in counts.items()) or "none")


if __name__ == "__main__":
    summarize(sys.stdin)
