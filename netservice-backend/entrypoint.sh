#!/bin/sh
set -e

# Write SSH private key from environment variable
if [ -z "$SSH_PRIVATE_KEY" ]; then
  echo "SSH_PRIVATE_KEY environment variable not set. Exiting."
  exit 1
fi
echo "$SSH_PRIVATE_KEY" > /root/.ssh/id_rsa
chmod 600 /root/.ssh/id_rsa

# Add SSH host to known_hosts to avoid prompt
ssh-keyscan -p 21098 server326.web-hosting.com >> /root/.ssh/known_hosts


# Start SSH tunnel in a loop with keepalive options
start_ssh_tunnel() {
  while true; do
    echo "Starting SSH tunnel..."
    ssh -o ServerAliveInterval=60 -o ServerAliveCountMax=3 -N -L 5522:127.0.0.1:3306 netscwjx@server326.web-hosting.com -p 21098 -i /root/.ssh/id_rsa
    echo "SSH tunnel exited. Restarting in 5 seconds..."
    sleep 5
  done
}

start_ssh_tunnel &
TUNNEL_PID=$!

# Wait for tunnel to be ready
for i in $(seq 1 15); do
  nc -z 127.0.0.1 5522 && break
  echo "Waiting for SSH tunnel to be ready..."
  sleep 2
done

if ! nc -z 127.0.0.1 5522; then
  echo "SSH tunnel failed to start."
  kill $TUNNEL_PID
  exit 1
fi

echo "SSH tunnel established. Starting FastAPI..."

# Start FastAPI app
exec uvicorn app.main:app --host 0.0.0.0 --port 8000