import { createServer } from "net";

function tryPort(port) {
  return new Promise((resolve) => {
    const server = createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

let port = 3000;
while (!(await tryPort(port))) {
  port++;
}
process.stdout.write(String(port));
