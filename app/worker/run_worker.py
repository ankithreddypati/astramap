import asyncio
from temporalio.client import Client
from temporalio.worker import Worker
from worker.workflows import EditImageWorkflow
from worker.activities import edit_image_activity

async def main():
    client = await Client.connect("localhost:7233")
    worker = Worker(
        client,
        task_queue="image-edit-queue",
        workflows=[EditImageWorkflow],
        activities=[edit_image_activity],
    )
    print("Worker started.")
    await worker.run()

if __name__ == "__main__":
    asyncio.run(main())