import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';

const FEISHU_BASE_URL = process.env.FEISHU_BASE_URL || 'https://open.feishu.cn';
const TIME_ZONE = process.env.FEISHU_TIME_ZONE || 'Asia/Shanghai';
const OUTPUT_FILE = resolve(process.cwd(), 'public', 'data.json');

const required = [
  'FEISHU_APP_ID',
  'FEISHU_APP_SECRET',
  'FEISHU_APP_TOKEN',
  'FEISHU_TABLE_ID'
];

for (const name of required) {
  if (!process.env[name]) {
    throw new Error(`缺少环境变量 ${name}。请在 GitHub Actions Secrets 中配置它。`);
  }
}

function getField(fields, name) {
  return fields?.[name];
}

function toText(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value).trim();
  }
  if (Array.isArray(value)) {
    return value.map(toText).filter(Boolean).join('、');
  }
  if (typeof value === 'object') {
    for (const key of ['text', 'name', 'link', 'url', 'value']) {
      if (value[key] !== undefined && value[key] !== null) {
        return toText(value[key]);
      }
    }
  }
  return '';
}

function toUrl(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value.trim();
  if (Array.isArray(value)) {
    return value.map(toUrl).find(Boolean) || '';
  }
  if (typeof value === 'object') {
    for (const key of ['link', 'url']) {
      if (value[key] !== undefined && value[key] !== null) {
        return toUrl(value[key]);
      }
    }
  }
  return '';
}

function toDate(value) {
  const text = toText(value);
  if (!text) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);

  const timestamp = Number(text);
  const date = Number.isFinite(timestamp)
    ? new Date(timestamp < 1e11 ? timestamp * 1000 : timestamp)
    : new Date(text);
  if (Number.isNaN(date.getTime())) return '';

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const getPart = type => parts.find(part => part.type === type)?.value;
  return `${getPart('year')}-${getPart('month')}-${getPart('day')}`;
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok || body.code !== 0) {
    throw new Error(`飞书 API 请求失败：${body.msg || response.statusText || response.status}`);
  }
  return body;
}

async function getTenantAccessToken() {
  const response = await requestJson(`${FEISHU_BASE_URL}/open-apis/auth/v3/tenant_access_token/internal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify({
      app_id: process.env.FEISHU_APP_ID,
      app_secret: process.env.FEISHU_APP_SECRET
    })
  });
  return response.tenant_access_token;
}

async function getAllRecords(token) {
  const records = [];
  let pageToken;

  do {
    const url = new URL(
      `${FEISHU_BASE_URL}/open-apis/bitable/v1/apps/${encodeURIComponent(process.env.FEISHU_APP_TOKEN)}/tables/${encodeURIComponent(process.env.FEISHU_TABLE_ID)}/records`
    );
    url.searchParams.set('page_size', '500');
    if (pageToken) url.searchParams.set('page_token', pageToken);

    const response = await requestJson(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    records.push(...(response.data?.items || []));
    pageToken = response.data?.has_more ? response.data.page_token : undefined;
  } while (pageToken);

  return records;
}

function transformRecord(record) {
  const fields = record.fields || {};
  const date = toDate(getField(fields, '整理日期'));
  const title = toText(getField(fields, '标题'));
  const topic = toText(getField(fields, '主题'));
  const summary = toText(getField(fields, '简介'));
  const link = toUrl(getField(fields, '链接（URL）')) || toUrl(getField(fields, '链接'));

  if (!date || !title) return null;
  return {
    '整理日期': date,
    '标题': title,
    '主题': topic,
    '简介': summary,
    '链接': link
  };
}

async function main() {
  const token = await getTenantAccessToken();
  const records = await getAllRecords(token);
  const reports = records
    .map(transformRecord)
    .filter(Boolean)
    .sort((a, b) => b['整理日期'].localeCompare(a['整理日期']) || a['标题'].localeCompare(b['标题'], 'zh-CN'));

  await mkdir(dirname(OUTPUT_FILE), { recursive: true });
  await writeFile(OUTPUT_FILE, `${JSON.stringify(reports, null, 2)}\n`, 'utf8');
  console.log(`已同步 ${reports.length} 条简报到 public/data.json。`);
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
