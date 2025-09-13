from rq import Worker, Queue, Connection
from redis import Redis

listen = ['default']

def run_worker() -> None:
    redis_conn = Redis()
    with Connection(redis_conn):
        worker = Worker(list(map(Queue, listen)))
        worker.work()

if __name__ == '__main__':
    run_worker()
