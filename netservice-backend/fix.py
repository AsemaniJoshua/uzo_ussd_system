import os
content = b"#!/bin/sh\nset -e\n\necho \"SSH tunnel established. Starting FastAPI...\"\nexec uvicorn app.main:app --host 0.0.0.0 --port 8001\n"
with open("entrypoint.sh", "wb") as f:
    f.write(content)
print("done")
