/* ==========================================================
   关键词命中引擎（纯逻辑，不依赖 DOM，便于单独测试）
   规则：异常文本命中任一启用中的关键词 → 该异常升级为紧急邮件；
        再按「关键词 × 子系统 × 紧急联系人」绑定关系，解析出收件人。
   ========================================================== */

const MATCH_MODES = ['包含', '前缀', '精确', '正则', '多词任一'];

function kwMatch(text, kw) {
  const t = String(text || '');
  const w = String((kw && kw.word) || '').trim();
  if (!t || !w) return false;
  switch (kw.match) {
    case '前缀': return t.startsWith(w);
    case '精确': return t === w;
    case '正则':
      try { return new RegExp(w, 'i').test(t); } catch (e) { return false; }
    case '多词任一':
      return w.split('|').some(x => { const s = x.trim(); return !!s && t.includes(s); });
    case '包含':
    default: return t.includes(w);
  }
}

/* 把文本中命中的关键词标红。」 */
function kwHighlight(text, keywords) {
  let html = esc(text);
  const words = new Set();
  keywords.forEach(k => {
    String(k.word || '').split('|').forEach(x => { const s = x.trim(); if (s) words.add(s); });
  });
  Array.from(words).sort((a, b) => b.length - a.length).forEach(w => {
    if (kwMatch(text, { word: w, match: '包含' })) {
      html = html.split(esc(w)).join(`<span class="hit-word">${esc(w)}</span>`);
    }
  });
  return html;
}

/**
 * 解析收件人
 * @param {Object} ctx { text, sysId, contacts, keywords, bindings }
 * @returns {Object} { hits, bindings, receivers, level, paused(是否进入免打扰合并) }
 */
function resolveDispatch(ctx) {
  const { text, sysId, contacts = [], keywords = [], bindings = [] } = ctx || {};
  const hits = keywords.filter(k => k.enabled && kwMatch(text, k));
  if (!hits.length) return { hits: [], bindings: [], receivers: [], level: '普通', emails: [] };

  const hitIds = new Set(hits.map(h => h.id));
  const bs = bindings.filter(b => b.enabled
    && b.kws.some(k => hitIds.has(k))
    && (b.sys.includes('ALL') || b.sys.includes(sysId)));

  const ids = new Set();
  bs.forEach(b => b.contacts.forEach(c => ids.add(c)));

  const level = hits.some(h => h.level === '特急') ? '特急' : '重要';
  const receivers = contacts.filter(c => ids.has(c.id) && c.enabled)
    .filter(c => level === '特急' || c.level !== '仅特急');

  return { hits, bindings: bs, receivers, level, emails: receivers.map(r => r.mail) };
}

/* 统计某条绑定覆盖到的「子系统 × 联系人」组合数 */
function bindingCoverage(b) {
  const s = b.sys.includes('ALL') ? SUBSYSTEMS.length : b.sys.length;
  return s * b.contacts.length;
}
