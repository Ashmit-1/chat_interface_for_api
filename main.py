from fastapi import FastAPI, HTTPException
from fastapi.responses import StreamingResponse
from typing import List, Literal
from pydantic import BaseModel, HttpUrl
from fastapi.middleware.cors import CORSMiddleware
import httpx
import json
from openai import AsyncOpenAI
from ollama import Client
import asyncio



class ChatMessage(BaseModel):
    role: Literal["system", "user", "assistant"]
    content: str


class Payload(BaseModel):
    endpoint: HttpUrl
    api_key: str
    model: str
    messages: List[ChatMessage]

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:5500",
        "http://localhost:5500"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)



# ---------- Streaming Generator ----------
async def stream_llm_response(payload : Payload):
    if "ollama" in str(payload.endpoint):
        client = Client(
            host="https://ollama.com",
            headers={'Authorization': 'Bearer ' + str(payload.api_key)}
        )
        messages=[m.model_dump() for m in payload.messages]

        loop = asyncio.get_event_loop()
        stream = await loop.run_in_executor(None, client.chat(model=payload.model, messages=messages, stream=True))
        for part in stream:
            print(part['message']['content'], end='', flush=True)
            yield part["message"]["content"]

        pass
    else:
        client = AsyncOpenAI(base_url=str(payload.endpoint), api_key=payload.api_key)
        stream = await client.chat.completions.create(
                model=payload.model,
                messages=[m.model_dump() for m in payload.messages],
                stream=True,
            )

        async for chunk in stream:
            # if chunk.choices and chunk.choices[0].delta and chunk.choices[0].delta.content:
            if chunk.choices:
                delta = chunk.choices[0].delta
                if delta.content:
                    yield delta.content
            


async def stream_llm_response_v1(payload: Payload):
    headers = {
        "Authorization": f"Bearer {payload.api_key}",
        "Content-Type": "application/json",
    }

    body = {
        "model": payload.model,
        "messages": [m.model_dump() for m in payload.messages],
        "stream": False if str(payload.endpoint) == "https://opencode.ai/zen/v1/chat/completions" else True
    }

    async with httpx.AsyncClient(timeout=None) as client:
        async with client.stream(
            "POST",
            str(payload.endpoint),
            headers=headers,
            json=body,
        ) as response:

            if response.status_code != 200:
                raise HTTPException(
                    status_code=response.status_code,
                    detail=await response.aread()
                )

            async for line in response.aiter_lines():
                if not line:
                    continue

                if body["stream"] == False:
                    print(line)
                    line = json.loads(line)
                    token = line["choices"][0]["message"]["content"]
                    yield token
                    break
                     
                # OpenAI / Sarvam style: "data: {...}"
                if line.startswith("data:"):
                    data = line.replace("data:", "").strip()
                    if data == "[DONE]":
                        break
                    try:
                        chunk = json.loads(data)
                        print("Got chunk :", chunk)


                        if "choices" in chunk:
                            token = (
                                chunk.get("choices", [{}])
                                    # .get("delta", {})
                                    # .get("content")
                            )
                            # token = chunk.get("choices")[0]["delta"]
                            # if "content" in token:
                            #     token = token["content"]
                            # if "delta" in token:
                            #     token = (
                            #         token.get("delta", {})
                            #         .get("content")
                            #     )
                            # else:
                            #     token = (
                            #         token[0].get("content")
                            #     )
                        print("Got token")


                        if token:
                            yield token

                    except json.JSONDecodeError:
                        continue
                else:
                    try:
                        chunk = json.loads(line)
                        
                        token = chunk.get("message", {}).get("content")
                        

                        if token:
                            # print(token)
                            yield token

                    except json.JSONDecodeError:
                        continue



# ---------- API Endpoint ----------
@app.post("/chat/stream")
async def chat(payload: Payload):
    return StreamingResponse(
        stream_llm_response(payload),
        media_type="text/plain",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"  # Disable buffering in nginx
        }
    )