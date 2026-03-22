#!/bin/bash

echo "Rebuilding ois-mcp-portal image..."
docker build -t ois-mcp-portal:latest .
echo "Build complete."
