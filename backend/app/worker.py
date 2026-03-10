"""
RQ Worker entry point.
Run with: python -m app.worker
"""

import os

import redis
from rq import Worker, Queue

REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")
conn = redis.from_url(REDIS_URL)

if __name__ == "__main__":
    queues = [Queue(connection=conn)]
    worker = Worker(queues, connection=conn)
    worker.work()
