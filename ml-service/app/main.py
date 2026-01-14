from fastapi import FastAPI


app = FastAPI(title="SciVisE ML Service")


@app.get("/health")
async def health() -> dict:
    """
    Simple healthcheck endpoint for docker-compose.
    No ML logic here yet, just returns a static status.
    """
    return {"status": "ok"}


