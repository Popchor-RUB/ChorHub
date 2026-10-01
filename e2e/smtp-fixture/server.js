const http = require('node:http');
const net = require('node:net');
const { randomUUID } = require('node:crypto');

const smtpPort = 1025;
const controlPort = 8026;
const controls = new Map();
const upstreamHost = process.env.SMTP_UPSTREAM_HOST || 'mailhog';
const upstreamPort = Number(process.env.SMTP_UPSTREAM_PORT || 1025);

function json(response, status, value) {
  response.writeHead(status, { 'content-type': 'application/json' });
  response.end(JSON.stringify(value));
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

const controlServer = http.createServer(async (request, response) => {
  if (request.method === 'GET' && request.url === '/health') return json(response, 200, { ok: true });

  if (request.method === 'POST' && request.url === '/controls') {
    try {
      const body = await readJson(request);
      if (typeof body.subjectMarker !== 'string' || !body.subjectMarker.trim()) {
        return json(response, 400, { error: 'subjectMarker is required' });
      }
      if (!['hold', 'reject'].includes(body.action)) {
        return json(response, 400, { error: 'action must be hold or reject' });
      }
      const id = randomUUID();
      const control = {
        id,
        subjectMarker: body.subjectMarker,
        action: body.action,
        state: 'armed',
        release: null,
      };
      controls.set(id, control);
      return json(response, 201, { id, state: control.state });
    } catch {
      return json(response, 400, { error: 'invalid JSON' });
    }
  }

  const match = request.url?.match(/^\/controls\/([\w-]+)(?:\/(release))?$/);
  if (!match) return json(response, 404, { error: 'not found' });
  const control = controls.get(match[1]);
  if (!control) return json(response, 404, { error: 'control not found' });

  if (request.method === 'GET' && !match[2]) {
    return json(response, 200, { id: control.id, state: control.state });
  }
  if (request.method === 'POST' && match[2] === 'release') {
    if (control.state !== 'held') return json(response, 409, { error: `control is ${control.state}` });
    control.release();
    return json(response, 200, { id: control.id, state: 'released' });
  }
  return json(response, 405, { error: 'method not allowed' });
});

const smtpServer = net.createServer((client) => {
  const upstream = net.createConnection({ host: upstreamHost, port: upstreamPort });
  let clientBuffer = Buffer.alloc(0);
  let serverBuffer = Buffer.alloc(0);
  let inData = false;
  let closed = false;

  upstream.on('data', (chunk) => {
    serverBuffer = Buffer.concat([serverBuffer, chunk]);
    let end;
    while ((end = serverBuffer.indexOf('\r\n')) !== -1) {
      const line = serverBuffer.subarray(0, end + 2);
      serverBuffer = serverBuffer.subarray(end + 2);
      const text = line.toString('latin1');
      if (/^354(?:[ -])/.test(text)) inData = true;
      client.write(line);
    }
  });
  client.on('data', (chunk) => {
    if (!inData) {
      clientBuffer = Buffer.concat([clientBuffer, chunk]);
      let end;
      while ((end = clientBuffer.indexOf('\r\n')) !== -1) {
        const line = clientBuffer.subarray(0, end + 2);
        clientBuffer = clientBuffer.subarray(end + 2);
        if (line.toString('latin1').trim().toUpperCase() === 'DATA') inData = 'awaiting';
        upstream.write(line);
      }
      if (inData === 'awaiting') inData = false;
      return;
    }

    clientBuffer = Buffer.concat([clientBuffer, chunk]);
    const terminator = clientBuffer.indexOf('\r\n.\r\n');
    if (terminator === -1) return;

    const message = clientBuffer.subarray(0, terminator + 5);
    const remaining = clientBuffer.subarray(terminator + 5);
    clientBuffer = Buffer.alloc(0);
    inData = false;
    const headerBlock = message.toString('latin1').split('\r\n\r\n', 1)[0]
      .replace(/\r\n[ \t]+/g, ' ');
    const subject = headerBlock.match(/^Subject:\s*(.*)$/im)?.[1] ?? '';
    const control = [...controls.values()].find((item) =>
      item.state === 'armed' && subject.includes(item.subjectMarker),
    );

    if (control?.action === 'reject') {
      control.state = 'rejected';
      client.write('554 5.7.1 Rejected by E2E SMTP fixture\r\n');
      closed = true;
      client.end();
      upstream.destroy();
      return;
    }

    if (control?.action === 'hold') {
      control.state = 'held';
      control.release = () => {
        control.state = 'released';
        upstream.write(message);
        if (remaining.length) upstream.write(remaining);
      };
      return;
    }

    upstream.write(message);
    if (remaining.length) upstream.write(remaining);
  });
  client.on('error', () => upstream.destroy());
  upstream.on('error', () => client.destroy());
  client.on('close', () => {
    if (!closed) upstream.destroy();
  });
});

controlServer.listen(controlPort, '0.0.0.0');
smtpServer.listen(smtpPort, '0.0.0.0');
