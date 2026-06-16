export default async function handler(req, res) {
  // 1. 设置跨域和 DNS 专属响应头，让 Chrome 放心
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'application/dns-message');
  res.setHeader('Cache-Control', 'max-age=0, private, must-revalidate');

  // 处理 Chrome 发起的预检请求
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // 2. 这里的上游 DNS 可以换成 https://dns.google 或 https://cloudflare-dns.com
  const UPSTREAM_DOH = 'https://cloudflare-dns.com';

  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const targetUrl = `${UPSTREAM_DOH}${url.search}`;

    // 3. 转发请求给官方 DNS
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: {
        'accept': 'application/dns-message',
        'content-type': req.method === 'POST' ? 'application/dns-message' : undefined,
      },
      body: req.method === 'POST' ? req.body : undefined,
    });

    // 4. 将官方返回的二进制 DNS 数据传回给 Chrome
    const data = await response.arrayBuffer();
    res.status(200).send(Buffer.from(data));
  } catch (error) {
    res.status(500).send('DNS Fetch Error');
  }
}
