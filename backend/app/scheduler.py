"""
APScheduler: Runs the daily warming scheduler at 08:00 UTC every day.
Run with: python -m app.scheduler
"""

import logging
import os
import time

from apscheduler.schedulers.blocking import BlockingScheduler

from .tasks import enqueue_warming_task

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

scheduler = BlockingScheduler(timezone="UTC")


@scheduler.scheduled_job("cron", hour=8, minute=0)
def daily_warming():
    logger.info("Running daily warming scheduler...")
    try:
        enqueue_warming_task("run_daily_scheduler")
        logger.info("Daily scheduler task enqueued.")
    except Exception as e:
        logger.error(f"Failed to enqueue daily scheduler: {e}")


if __name__ == "__main__":
    logger.info("Starting APScheduler (daily warming at 08:00 UTC)...")
    scheduler.start()
