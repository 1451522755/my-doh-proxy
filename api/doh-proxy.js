export default async function handler(req, res) {
  // 1. 设置跨域头，允许所有请求
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // 2. 上游改用官方顶级域名，确保握手百分百成功
  const UPSTREAM_DOH = 'https://cloudflare-dns.com';

  try {
    const url = new URL(req.url, `http://${req.headers.host}`);
    
    // 3. 构造完美的请求头，把 Chrome 发来的各种杂七杂八的数据原样打包
    const headers = {
      'accept': req.headers['accept'] || 'application/dns-message',
    };
    if (req.method === 'POST') {
      headers['content-type'] = req.headers['content-type'] || 'application/dns-message';
    }

    const targetUrl = `${UPSTREAM_DOH}${url.search}`;

    const response = await fetch(targetUrl, {
      method: req.method,
      headers: headers,
      body: req.method === 'POST' ? req.body : undefined,
    });

    // 4. 将上游的头部信息透传回给 Chrome（包含关键的 Content-Type）
    res.setHeader('Content-Type', response.headers.get('Content-Type') || 'application/dns-message');
    res.setHeader('Cache-Control', response.headers.get('Cache-Control') || 'max-age=0, private, must-revalidate');

    const data = await response.arrayBuffer();
    res.status(200).send(Buffer.from(data));
  } catch (error) {
    res.status(500).send('DNS Forward Error');
  }
}
