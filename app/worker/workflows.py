from datetime import timedelta
from temporalio import workflow
from dataclasses import dataclass

with workflow.unsafe.imports_passed_through():
    from worker.activities import edit_image_activity

@dataclass
class EditImageInput:
    image_b64: str
    prompt: str

@workflow.defn
class EditImageWorkflow:
    @workflow.run
    async def run(self, input: EditImageInput) -> str:
        return await workflow.execute_activity(
            edit_image_activity,
            args=[input.image_b64, input.prompt],
            schedule_to_close_timeout=timedelta(minutes=5),
        )