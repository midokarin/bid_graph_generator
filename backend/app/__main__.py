import os

import uvicorn

if __name__ == "__main__":
    port = int(os.getenv("BIAOSHU_API_PORT", "8000"))
    if not 1 <= port <= 65535:
        raise SystemExit("BIAOSHU_API_PORT must be between 1 and 65535")
    uvicorn.run("app.main:app", host="127.0.0.1", port=port, access_log=False)
