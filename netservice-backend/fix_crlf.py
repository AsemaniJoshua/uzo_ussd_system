import sys

with open(sys.argv[1], 'rb') as f:
    content = f.read()

content = content.replace(b'\r\n', b'\n')

with open(sys.argv[1], 'wb') as f:
    f.write(content)
