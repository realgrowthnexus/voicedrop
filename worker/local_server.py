"""Local stand-in for a RunPod serverless endpoint (development + E2E only).

POST /run      {"input": {...}, "webhook": "http://..."} -> {"id", "status": "IN_QUEUE"}
GET  /status/<id>                                      -> {"id", "status", "output"|"error"}
GET  /health

Jobs run one at a time (FIFO) with the real Kokoro pipeline. When a job ends,
the result is POSTed to the webhook exactly like RunPod does.
"""

from __future__ import annotations

import json
import os
import queue
import sys
import threading
import traceback
import uuid
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import requests

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from vd_worker.handler import get_engine, process_job, unwrap  # noqa: E402

os.environ.setdefault("VD_ALLOW_HTTP_UPLOADS", "1")
TOKEN = os.environ.get("LOCAL_WORKER_TOKEN", "")

jobs: dict[str, dict] = {}
work: "queue.Queue[tuple[str, dict, str | None]]" = queue.Queue()


def worker_loop() -> None:
    eng = get_engine()
    while True:
        job_id, inp, webhook = work.get()
        jobs[job_id]["status"] = "IN_PROGRESS"
        try:
            out = process_job(unwrap(inp), eng)
            jobs[job_id].update(status="COMPLETED", output=out)
        except Exception as e:  # noqa: BLE001
            traceback.print_exc()
            jobs[job_id].update(status="FAILED", error=str(e))
        if webhook:
            try:
                requests.post(webhook, json=jobs[job_id], timeout=15)
            except requests.RequestException as e:
                print(f"webhook failed: {e}", file=sys.stderr)


class H(BaseHTTPRequestHandler):
    def _send(self, code: int, body: dict) -> None:
        data = json.dumps(body).encode()
        self.send_response(code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def _authorized(self) -> bool:
        return not TOKEN or self.headers.get("Authorization") == f"Bearer {TOKEN}"

    def do_GET(self) -> None:  # noqa: N802
        if self.path == "/health":
            return self._send(200, {"ok": True, "queued": work.qsize()})
        if not self._authorized():
            return self._send(401, {"error": "unauthorized"})
        if self.path.startswith("/status/"):
            j = jobs.get(self.path.split("/")[-1])
            return self._send(200, j) if j else self._send(404, {"error": "not found"})
        self._send(404, {"error": "not found"})

    def do_POST(self) -> None:  # noqa: N802
        if not self._authorized():
            return self._send(401, {"error": "unauthorized"})
        if self.path != "/run":
            return self._send(404, {"error": "not found"})
        length = int(self.headers.get("Content-Length", "0"))
        body = json.loads(self.rfile.read(length) or b"{}")
        job_id = uuid.uuid4().hex
        jobs[job_id] = {"id": job_id, "status": "IN_QUEUE"}
        work.put((job_id, body.get("input") or {}, body.get("webhook")))
        self._send(200, {"id": job_id, "status": "IN_QUEUE"})

    def log_message(self, fmt: str, *args) -> None:  # quieter logs
        sys.stderr.write("[worker] " + fmt % args + "\n")


if __name__ == "__main__":
    port = int(os.environ.get("PORT", "8188"))
    threading.Thread(target=worker_loop, daemon=True).start()
    print(f"local worker on http://127.0.0.1:{port}", flush=True)
    ThreadingHTTPServer(("127.0.0.1", port), H).serve_forever()
