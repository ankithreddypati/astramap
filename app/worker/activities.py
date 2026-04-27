import httpx
from temporalio import activity

VLLM_HOST = "http://localhost:9000"

@activity.defn
async def edit_image_activity(image_b64: str, prompt: str) -> str:
    async with httpx.AsyncClient(timeout=300) as client:
        response = await client.post(
            f"{VLLM_HOST}/v1/chat/completions",
            json={
                "model": "Qwen/Qwen-Image-Edit",
                "messages": [
                    {
                        "role": "user",
                        "content": [
                            {"type": "text", "text": prompt},
                            {
                                "type": "image_url",
                                "image_url": {
                                    "url": f"data:image/jpeg;base64,{image_b64}"
                                }
                            }
                        ]
                    }
                ]
            }
        )
        response.raise_for_status()
        result = response.json()
        return result["choices"][0]["message"]["content"]