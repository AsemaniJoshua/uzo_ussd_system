# #!/bin/sh
# set -e

# # Write SSH private key from environment variable
# if [ -z "$SSH_PRIVATE_KEY" ]; then
#   echo "SSH_PRIVATE_KEY environment variable not set. Exiting."
#   exit 1
# fi
# echo "$SSH_PRIVATE_KEY" > /root/.ssh/id_rsa
# chmod 600 /root/.ssh/id_rsa

# # Add SSH host to known_hosts to avoid prompt
# ssh-keyscan -p 21098 server326.web-hosting.com >> /root/.ssh/known_hosts


# # Start SSH tunnel in a loop with keepalive options
# start_ssh_tunnel() {
#   while true; do
#     echo "Starting SSH tunnel..."
#     ssh -o ServerAliveInterval=60 -o ServerAliveCountMax=3 -N -L 5522:127.0.0.1:3306 netscwjx@server326.web-hosting.com -p 21098 -i /root/.ssh/id_rsa
#     echo "SSH tunnel exited. Restarting in 5 seconds..."
#     sleep 5
#   done
# }

# start_ssh_tunnel &
# TUNNEL_PID=$!

# # Wait for tunnel to be ready
# for i in $(seq 1 15); do
#   nc -z 127.0.0.1 5522 && break
#   echo "Waiting for SSH tunnel to be ready..."
#   sleep 2
# done

# if ! nc -z 127.0.0.1 5522; then
#   echo "SSH tunnel failed to start."
#   kill $TUNNEL_PID
#   exit 1
# fi

# echo "SSH tunnel established. Starting FastAPI..."

# # Start FastAPI app
# exec uvicorn app.main:app --host 0.0.0.0 --port 8001


# _________________________________________________________________________________________________________________________________________________________
#!/bin/sh
set -e

# # We no longer need to write the key because Docker "mounts" it for us.
# # Just verify the file actually exists where we expect it.
# if [ ! -f /root/.ssh/id_rsa ]; then
#     echo "SSH key file not found at /root/.ssh/id_rsa. Exiting."
#     exit 1
# fi

# # Ensure permissions are correct (SSH is very strict)
# chmod 600 /root/.ssh/id_rsa

# # Add SSH host to known_hosts to avoid prompt
# ssh-keyscan -p 21098 server326.web-hosting.com >> /root/.ssh/known_hosts

# # Start SSH tunnel in a loop
# start_ssh_tunnel() {
#     while true; do
#         echo "Starting SSH tunnel..."
#         ssh -o ServerAliveInterval=60 -o ServerAliveCountMax=3 -N -L 5522:127.0.0.1:3306 netscwjx@server326.web-hosting.com -p 21098 -i /root/.ssh/id_rsa
#         echo "SSH tunnel exited. Restarting in 5 seconds..."
#         sleep 5
#     done
# }

# start_ssh_tunnel &
# TUNNEL_PID=$!

# # Wait for tunnel to be ready
# for i in $(seq 1 15); do
#     nc -z 127.0.0.1 5522 && break
#     echo "Waiting for SSH tunnel to be ready..."
#     sleep 2
# done

# if ! nc -z 127.0.0.1 5522; then
#     echo "SSH tunnel failed to start."
#     kill $TUNNEL_PID
#     exit 1
# fi

echo "SSH tunnel established. Starting FastAPI..."
# Start FastAPI app
exec uvicorn app.main:app --host 0.0.0.0 --port 8001




# _________________________________________________________________________________________________________________________________________________________
# cat << 'EOF' > entrypoint.sh
# #!/bin/sh
# set -e

# # Verify key exists
# if [ ! -f /root/.ssh/id_rsa ]; then
#     echo "Key missing at /root/.ssh/id_rsa"
#     exit 1
# fi

# # Clean up known_hosts and scan the server to avoid the "trust" prompt
# mkdir -p /root/.ssh
# touch /root/.ssh/known_hosts
# ssh-keyscan -p 21098 ://web-hosting.com >> /root/.ssh/known_hosts

# start_ssh_tunnel() {
#     while true; do
#         echo "Starting SSH tunnel..."
#         # -L 5522:127.0.0.1:3306 maps the remote DB to local port 5522
#         ssh -o ServerAliveInterval=60 -o StrictHostKeyChecking=no -N -L 5522:127.0.0.1:3306 netscwjx@://web-hosting.com -p 21098 -i /root/.ssh/id_rsa
#         sleep 5
#     done
# }

# start_ssh_tunnel &
# TUNNEL_PID=$!

# # Wait for tunnel to be active before starting FastAPI
# for i in $(seq 1 10); do
#     if nc -z 127.0.0.1 5522; then
#         echo "SSH tunnel established. Starting FastAPI..."
#         exec uvicorn app.main:app --host 0.0.0.0 --port 8000
#     fi
#     sleep 3
# done

# echo "Tunnel failed."
# kill $TUNNEL_PID
# exit 1
# EOF

