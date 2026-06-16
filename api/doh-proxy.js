export default async function handler(req, res) {
  // 1. 允许跨域
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // 2. 设定纯净的上游地址（这里可以用谷歌，也可以用 Cloudflare 官方）
  // 推荐使用 cloudflare-dns.com，它对标准 DoH 支持最稳定
  const UPSTREAM_DOH = 'https://cloudflare-dns.com';

  try {
    // 3. 核心修复：只提取客户端发来的 ?dns=xxx 或 ?name=xxx 等参数
    const url = new URL(req.url, `http://${req.headers.host}`);
    const searchParams = url.search; // 这会拿到 "?dns=AAABAAAB..."
    
    // 4. 重新组装：确保发给上游的网址是绝对纯净的 https://cloudflare-dns.com?dns=xxxx
    const targetUrl = `${UPSTREAM_DOH}${searchParams}`;

    // 5. 打包请求头
    const headers = {
      'accept': 'application/dns-message',
    };
    if (req.method === 'POST') {
      headers['content-type'] = 'application/dns-message';
    }

    // 6. 发起请求
    const response = await fetch(targetUrl, {
      method: req.method,
      headers: headers,
      body: req.method === 'POST' ? req.body : undefined,
    });

    // 7. 返回正确的数据类型
    res.setHeader('Content-Type', 'application/dns-message');
    res.setHeader('Cache-Control', 'max-age=0, private, must-revalidate');

    const data = await response.arrayBuffer();
    res.status(200).send(Buffer.from(data));
  } catch (error) {
    res.status(500).send('DNS Forward Error');
  }
}
