import uuid
from fastapi import FastAPI, UploadFile, File, Form
from temporalio.client import Client
from worker.workflows import EditImageWorkflow, EditImageInput

app = FastAPI()
temporal_client = None

@app.on_event("startup")
async def startup():
    global temporal_client
    temporal_client = await Client.connect("localhost:7233")

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.post("/edit")
async def edit_image(
    prompt: str = Form(...),
    image: UploadFile = File(...),
):
    image_bytes = await image.read()
    image_b64 = __import__("base64").b64encode(image_bytes).decode()
    job_id = f"edit-{uuid.uuid4()}"

    await temporal_client.start_workflow(
        EditImageWorkflow.run,
        EditImageInput(image_b64=image_b64, prompt=prompt),
        id=job_id,
        task_queue="image-edit-queue",
    )

    return {"job_id": job_id, "status": "pending"}

@app.get("/status/{job_id}")
async def get_status(job_id: str):
    handle = temporal_client.get_workflow_handle(job_id)
    desc = await handle.describe()
    status = desc.status.name.lower()

    result = None
    if status == "completed":
        result = await handle.result()

    return {"job_id": job_id, "status": status, "result": result}