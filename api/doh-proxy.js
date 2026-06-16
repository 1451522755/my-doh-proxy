export default async function handler(req, res) {
  // 1. 允许所有跨域请求，满足 Chrome 校验要求
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // 2. 纯净的上游服务
  const UPSTREAM_URL = 'https://cloudflare-dns.com';

  try {
    let dnsMessage;

    // 3. 区分 GET 和 POST 请求，精准提取二进制 DNS 报文
    if (req.method === 'GET') {
      const { dns } = req.query;
      if (!dns) {
        return res.status(400).send('Missing dns parameter');
      }
      // 将 base64url 编码的参数还原为二进制 Buffer
      let base64 = dns.replace(/-/g, '+').replace(/_/g, '/');
      while (base64.length % 4) base64 += '=';
      dnsMessage = Buffer.from(base64, 'base64');
    } else if (req.method === 'POST') {
      dnsMessage = req.body;
    }

    // 4. 使用严格的参数和请求头，强行伪装成标准 DoH 请求
    const targetUrl = new URL(UPSTREAM_URL);
    if (req.method === 'GET') {
      targetUrl.searchParams.set('dns', req.query.dns);
    }

    const response = await fetch(targetUrl.toString(), {
      method: req.method,
      headers: {
        'Accept': 'application/dns-message',
        'Content-Type': 'application/dns-message',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) DoH-Client/1.0',
      },
      body: req.method === 'POST' ? dnsMessage : undefined,
    });

    // 5. 检查上游状态
    if (!response.ok) {
      return res.status(response.status).send('Upstream DNS Error');
    }

    // 6. 强制透传纯二进制数据，彻底杜绝 HTML 网页的产生
    const arrayBuffer = await response.arrayBuffer();
    const outputBuffer = Buffer.from(arrayBuffer);

    res.setHeader('Content-Type', 'application/dns-message');
    res.setHeader('Cache-Control', 'max-age=0, private, must-revalidate');
    res.status(200).send(outputBuffer);

  } catch (error) {
    console.error(error);
    res.status(500).send('Internal Server Error');
  }
}
